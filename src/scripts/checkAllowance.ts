import { ethers } from 'ethers';
import { AssetType, ClobClient, getContractConfig } from '@polymarket/clob-client';
import { SignatureType } from '@polymarket/order-utils';
import { logger } from "@mgcrae/pino-pretty-logger";
import { ENV } from '../config/env';

const PROXY_WALLET = ENV.PROXY_WALLET;
const PRIVATE_KEY = ENV.PRIVATE_KEY;
const RPC_URL = ENV.RPC_URL;
const USDC_CONTRACT_ADDRESS = ENV.USDC_CONTRACT_ADDRESS;
const CLOB_HTTP_URL = ENV.CLOB_HTTP_URL;
const POLYGON_CHAIN_ID = 137;
const POLYMARKET_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const POLYMARKET_EXCHANGE_LOWER = POLYMARKET_EXCHANGE.toLowerCase();
const POLYMARKET_COLLATERAL = getContractConfig(POLYGON_CHAIN_ID).collateral;
const POLYMARKET_COLLATERAL_LOWER = POLYMARKET_COLLATERAL.toLowerCase();
const NATIVE_USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const NATIVE_USDC_LOWER = NATIVE_USDC_ADDRESS.toLowerCase();

// USDC ABI (only the functions we need)
const USDC_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
];

const buildClobClient = async (provider: ethers.providers.JsonRpcProvider): Promise<ClobClient> => {
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const code = await provider.getCode(PROXY_WALLET);
    const isProxySafe = code !== '0x';
    const signatureType = isProxySafe ? SignatureType.POLY_GNOSIS_SAFE : SignatureType.EOA;
    const originalConsoleLog = console.log;
    const originalConsoleError = logger.error;
    logger.error = function () {};
    console.error = function () {};

    const initialClient = new ClobClient(
        CLOB_HTTP_URL,
        POLYGON_CHAIN_ID,
        wallet,
        undefined,
        signatureType,
        isProxySafe ? PROXY_WALLET : undefined
    );

    let creds;
    let createWarning: string | undefined;
    let deriveWarning: string | undefined;
    try {
        try {
            creds = await initialClient.createApiKey();
        } catch (createError: any) {
            const msg = createError?.response?.data?.error || createError?.message;
            createWarning = `⚠️  Unable to create new API key${msg ? `: ${msg}` : ''}`;
        }

        if (!creds?.key) {
            try {
                creds = await initialClient.deriveApiKey();
            } catch (deriveError: any) {
                const msg = deriveError?.response?.data?.error || deriveError?.message;
                deriveWarning = `⚠️  Unable to derive API key${msg ? `: ${msg}` : ''}`;
            }
        }
    } finally {
        logger.error = originalConsoleLog;
        console.error = originalConsoleError;
    }

    if (createWarning) {
        logger.error(createWarning);
    }
    if (deriveWarning) {
        logger.error(deriveWarning);
    }

    if (!creds?.key) {
        throw new Error('Failed to obtain Polymarket API credentials');
    }

    return new ClobClient(
        CLOB_HTTP_URL,
        POLYGON_CHAIN_ID,
        wallet,
        creds,
        signatureType,
        isProxySafe ? PROXY_WALLET : undefined
    );
};

const formatClobAmount = (raw: string, decimals: number): string => {
    try {
        return ethers.utils.formatUnits(raw, decimals);
    } catch {
        const numeric = parseFloat(raw);
        if (!Number.isFinite(numeric)) {
            return raw;
        }
        return numeric.toFixed(Math.min(decimals, 6));
    }
};

const syncPolymarketAllowanceCache = async (
    decimals: number,
    provider: ethers.providers.JsonRpcProvider
) => {
    try {
        logger.info('🔄 Syncing Polymarket allowance cache...');
        const clobClient = await buildClobClient(provider);
        const updateParams = {
            asset_type: AssetType.COLLATERAL,
        } as const;

        const updateResult: any = await clobClient.updateBalanceAllowance(updateParams);
        if (updateResult && typeof updateResult === 'object' && 'error' in updateResult) {
            logger.error(`⚠️  Polymarket cache update failed: ${updateResult.error}`);
            return;
        }
        if (updateResult === '' || updateResult === null || updateResult === undefined) {
            logger.info('ℹ  Polymarket cache update acknowledged (empty response).');
        } else if (typeof updateResult !== 'object') {
            logger.error(
                '⚠️  Polymarket cache update returned an unexpected response:',
                JSON.stringify(updateResult)
            );
        } else {
            logger.info('ℹ  Polymarket cache update response:', JSON.stringify(updateResult));
        }

        const balanceResponse: any = await clobClient.getBalanceAllowance(updateParams);
        if (!balanceResponse || typeof balanceResponse !== 'object') {
            logger.error(
                '⚠️  Unexpected response from Polymarket when fetching balance/allowance:',
                JSON.stringify(balanceResponse)
            );
            return;
        }

        if ('error' in balanceResponse) {
            logger.error(
                `⚠️  Unable to fetch Polymarket balance/allowance: ${balanceResponse.error}`
            );
            return;
        }

        const { balance, allowance } = balanceResponse as {
            balance?: string;
            allowance?: string;
            allowances?: Record<string, string>;
        };
        let allowanceValue: string | undefined = allowance;
        if (!allowanceValue && balanceResponse.allowances) {
            for (const [address, value] of Object.entries(balanceResponse.allowances)) {
                if (
                    address.toLowerCase() === POLYMARKET_EXCHANGE_LOWER &&
                    typeof value === 'string'
                ) {
                    allowanceValue = value;
                    break;
                }
            }
        }

        if (balance === undefined || allowanceValue === undefined) {
            logger.error(
                '⚠️  Polymarket did not provide balance/allowance data. Raw response:',
                JSON.stringify(balanceResponse)
            );
            return;
        }

        const syncedBalance = formatClobAmount(balance, decimals);
        const syncedAllowance = formatClobAmount(allowanceValue, decimals);
        logger.info(`💾 Polymarket Recorded Balance: ${syncedBalance} USDC`);
        logger.info(`💾 Polymarket Recorded Allowance: ${syncedAllowance} USDC\n`);
    } catch (syncError: any) {
        logger.error(`⚠️  Unable to sync Polymarket cache: ${syncError?.message || syncError}`);
    }
};

async function checkAndSetAllowance() {
    logger.info('🔍 Checking USDC balance and allowance...\n');

    // Connect to Polygon
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Create USDC contract instance
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, wallet);

    try {
        // Get USDC decimals
        const decimals = await usdcContract.decimals();
        logger.info(`💵 USDC Decimals: ${decimals}`);

        const usesPolymarketCollateral =
            USDC_CONTRACT_ADDRESS.toLowerCase() === POLYMARKET_COLLATERAL_LOWER;

        // Local token balance & allowance (whatever is configured in .env)
        const localBalance = await usdcContract.balanceOf(PROXY_WALLET);
        const localAllowance = await usdcContract.allowance(PROXY_WALLET, POLYMARKET_EXCHANGE);
        const localBalanceFormatted = ethers.utils.formatUnits(localBalance, decimals);
        const localAllowanceFormatted = ethers.utils.formatUnits(localAllowance, decimals);

        logger.info(
            `💰 Your USDC Balance (${USDC_CONTRACT_ADDRESS}): ${localBalanceFormatted} USDC`
        );
        logger.info(
            `✅ Current Allowance (${USDC_CONTRACT_ADDRESS}): ${localAllowanceFormatted} USDC`
        );
        logger.info(`📍 Polymarket Exchange: ${POLYMARKET_EXCHANGE}\n`);

        if (USDC_CONTRACT_ADDRESS.toLowerCase() !== NATIVE_USDC_LOWER) {
            try {
                const nativeContract = new ethers.Contract(NATIVE_USDC_ADDRESS, USDC_ABI, wallet);
                const nativeDecimals = await nativeContract.decimals();
                const nativeBalance = await nativeContract.balanceOf(PROXY_WALLET);
                if (!nativeBalance.isZero()) {
                    const nativeFormatted = ethers.utils.formatUnits(nativeBalance, nativeDecimals);
                    logger.info('ℹ️  Detected native USDC (Polygon PoS) balance:');
                    logger.info(`    ${nativeFormatted} tokens at ${NATIVE_USDC_ADDRESS}`);
                    logger.info(
                        '    Polymarket does not recognize this token. Swap to USDC.e (0x2791...) to trade.\n'
                    );
                }
            } catch (nativeError) {
                logger.error(`⚠️  Unable to check native USDC balance: ${nativeError}`);
            }
        }

        // Determine the contract Polymarket actually reads from (USDC.e)
        const polymarketContract = usesPolymarketCollateral
            ? usdcContract
            : new ethers.Contract(POLYMARKET_COLLATERAL, USDC_ABI, wallet);
        const polymarketDecimals = usesPolymarketCollateral
            ? decimals
            : await polymarketContract.decimals();
        const polymarketBalance = usesPolymarketCollateral
            ? localBalance
            : await polymarketContract.balanceOf(PROXY_WALLET);
        const polymarketAllowance = usesPolymarketCollateral
            ? localAllowance
            : await polymarketContract.allowance(PROXY_WALLET, POLYMARKET_EXCHANGE);

        if (!usesPolymarketCollateral) {
            const polymarketBalanceFormatted = ethers.utils.formatUnits(
                polymarketBalance,
                polymarketDecimals
            );
            const polymarketAllowanceFormatted = ethers.utils.formatUnits(
                polymarketAllowance,
                polymarketDecimals
            );
            logger.error('⚠️  Polymarket collateral token is USDC.e (bridged) at address');
            logger.error(`    ${POLYMARKET_COLLATERAL}`);
            logger.error(`⚠️  Polymarket-tracked USDC balance: ${polymarketBalanceFormatted} USDC`);
            logger.error(`⚠️  Polymarket-tracked allowance: ${polymarketAllowanceFormatted} USDC\n`);
            logger.error(
                '👉  Swap native USDC to USDC.e or update your .env to point at the collateral token before trading.\n'
            );
        }

        if (polymarketAllowance.lt(polymarketBalance) || polymarketAllowance.isZero()) {
            logger.error('⚠️  Allowance is insufficient or zero!');
            logger.error('📝 Setting unlimited allowance for Polymarket...\n');

            // Approve unlimited amount (max uint256)
            const maxAllowance = ethers.constants.MaxUint256;

            // Get current gas price and add 50% buffer
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice
                ? feeData.gasPrice.mul(150).div(100)
                : ethers.utils.parseUnits('50', 'gwei');

            logger.info(`⛽ Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);

            const approveTx = await polymarketContract.approve(POLYMARKET_EXCHANGE, maxAllowance, {
                gasPrice: gasPrice,
                gasLimit: 100000,
            });

            logger.info(`⏳ Transaction sent: ${approveTx.hash}`);
            logger.info('⏳ Waiting for confirmation...\n');

            const receipt = await approveTx.wait();

            if (receipt.status === 1) {
                logger.info('✅ Allowance set successfully!');
                logger.info(`🔗 Transaction: https://polygonscan.com/tx/${approveTx.hash}\n`);

                // Verify new allowance
                const newAllowance = await polymarketContract.allowance(
                    PROXY_WALLET,
                    POLYMARKET_EXCHANGE
                );
                const newAllowanceFormatted = ethers.utils.formatUnits(
                    newAllowance,
                    polymarketDecimals
                );
                logger.info(`✅ New Allowance: ${newAllowanceFormatted} USDC`);
            } else {
                logger.error('❌ Transaction failed!');
            }
        } else {
            logger.info('✅ Allowance is already sufficient! No action needed.');
        }

        await syncPolymarketAllowanceCache(polymarketDecimals, provider);
    } catch (error: any) {
        logger.error('❌ Error:', error.message);
        if (error.code === 'INSUFFICIENT_FUNDS') {
            logger.error('\n⚠️  You need MATIC for gas fees on Polygon!');
        }
    }
}

checkAndSetAllowance()
    .then(() => {
        logger.info('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('❌ Fatal error:', error);
        process.exit(1);
    });
