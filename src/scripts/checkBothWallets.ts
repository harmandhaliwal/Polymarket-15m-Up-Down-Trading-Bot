import { ENV } from '../config/env';
import fetchData from '../utils/fetchData';
import getMyBalance from '../utils/getMyBalance';

const PROXY_WALLET = ENV.PROXY_WALLET;

interface Activity {
    proxyWallet: string;
    timestamp: number;
    conditionId: string;
    type: string;
    size: number;
    usdcSize: number;
    transactionHash: string;
    price: number;
    asset: string;
    side: 'BUY' | 'SELL';
    title?: string;
    slug?: string;
    outcome?: string;
}

interface Position {
    asset: string;
    conditionId: string;
    size: number;
    avgPrice: number;
    initialValue: number;
    currentValue: number;
    cashPnl: number;
    percentPnl: number;
    totalBought: number;
    realizedPnl: number;
    percentRealizedPnl: number;
    curPrice: number;
    title?: string;
    slug?: string;
    outcome?: string;
}

const checkBothWallets = async () => {
    console.log('🔍 CHECKING BOTH ADDRESSES\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const ADDRESS_1 = '0x4fbBe5599c06e846D2742014c9eB04A8a3d1DE8C'; // From .env
    const ADDRESS_2 = '0xd62531bc536bff72394fc5ef715525575787e809'; // From profile

    try {
        // 1. Check first address (from .env)
        console.log('📊 ADDRESS 1 (from .env - PROXY_WALLET):\n');
        console.log(`   ${ADDRESS_1}`);
        console.log(`   Profile: https://polymarket.com/profile/${ADDRESS_1}\n`);

        const addr1Activities: Activity[] = await fetchData(
            `https://data-api.polymarket.com/activity?user=${ADDRESS_1}&type=TRADE`
        );
        const addr1Positions: Position[] = await fetchData(
            `https://data-api.polymarket.com/positions?user=${ADDRESS_1}`
        );

        console.log(`   • Trades in API: ${addr1Activities?.length || 0}`);
        console.log(`   • Positions in API: ${addr1Positions?.length || 0}`);

        if (addr1Activities && addr1Activities.length > 0) {
            const buyTrades = addr1Activities.filter((a) => a.side === 'BUY');
            const sellTrades = addr1Activities.filter((a) => a.side === 'SELL');
            const totalVolume =
                buyTrades.reduce((s, t) => s + t.usdcSize, 0) +
                sellTrades.reduce((s, t) => s + t.usdcSize, 0);

            console.log(`   • Buys: ${buyTrades.length}`);
            console.log(`   • Sells: ${sellTrades.length}`);
            console.log(`   • Volume: $${totalVolume.toFixed(2)}`);

            // Show proxyWallet from first trade
            if (addr1Activities[0]?.proxyWallet) {
                console.log(`   • proxyWallet in trades: ${addr1Activities[0].proxyWallet}`);
            }
        }

        // Balance
        try {
            const balance1 = await getMyBalance(ADDRESS_1);
            console.log(`   • USDC Balance: $${balance1.toFixed(2)}`);
        } catch (e) {
            console.log('   • USDC Balance: failed to get');
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 2. Check second address (from profile @shbot)
        console.log('📊 ADDRESS 2 (from profile @shbot):\n');
        console.log(`   ${ADDRESS_2}`);
        console.log(`   Profile: https://polymarket.com/profile/${ADDRESS_2}\n`);

        const addr2Activities: Activity[] = await fetchData(
            `https://data-api.polymarket.com/activity?user=${ADDRESS_2}&type=TRADE`
        );
        const addr2Positions: Position[] = await fetchData(
            `https://data-api.polymarket.com/positions?user=${ADDRESS_2}`
        );

        console.log(`   • Trades in API: ${addr2Activities?.length || 0}`);
        console.log(`   • Positions in API: ${addr2Positions?.length || 0}`);

        if (addr2Activities && addr2Activities.length > 0) {
            const buyTrades = addr2Activities.filter((a) => a.side === 'BUY');
            const sellTrades = addr2Activities.filter((a) => a.side === 'SELL');
            const totalVolume =
                buyTrades.reduce((s, t) => s + t.usdcSize, 0) +
                sellTrades.reduce((s, t) => s + t.usdcSize, 0);

            console.log(`   • Buys: ${buyTrades.length}`);
            console.log(`   • Sells: ${sellTrades.length}`);
            console.log(`   • Volume: $${totalVolume.toFixed(2)}`);

            // Show proxyWallet from first trade
            if (addr2Activities[0]?.proxyWallet) {
                console.log(`   • proxyWallet in trades: ${addr2Activities[0].proxyWallet}`);
            }

            // Last 5 trades for comparison
            console.log('\n   📝 Last 5 trades:');
            addr2Activities.slice(0, 5).forEach((trade, idx) => {
                const date = new Date(trade.timestamp * 1000);
                console.log(`      ${idx + 1}. ${trade.side} - ${trade.title || 'Unknown'}`);
                console.log(
                    `         $${trade.usdcSize.toFixed(2)} @ ${date.toLocaleString('en-US')}`
                );
                console.log(
                    `         TX: ${trade.transactionHash.slice(0, 10)}...${trade.transactionHash.slice(-6)}`
                );
            });
        }

        // Balance
        try {
            const balance2 = await getMyBalance(ADDRESS_2);
            console.log(`\n   • USDC Balance: $${balance2.toFixed(2)}`);
        } catch (e) {
            console.log('\n   • USDC Balance: failed to get');
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 3. Comparison
        console.log('🔍 ADDRESS COMPARISON:\n');

        const addr1HasData =
            (addr1Activities?.length || 0) > 0 || (addr1Positions?.length || 0) > 0;
        const addr2HasData =
            (addr2Activities?.length || 0) > 0 || (addr2Positions?.length || 0) > 0;

        console.log(`   Address 1 (${ADDRESS_1.slice(0, 8)}...):`);
        console.log(`   ${addr1HasData ? '✅ Has data' : '❌ No data'}`);
        console.log(`   • Trades: ${addr1Activities?.length || 0}`);
        console.log(`   • Positions: ${addr1Positions?.length || 0}\n`);

        console.log(`   Address 2 (${ADDRESS_2.slice(0, 8)}...):`);
        console.log(`   ${addr2HasData ? '✅ Has data' : '❌ No data'}`);
        console.log(`   • Trades: ${addr2Activities?.length || 0}`);
        console.log(`   • Positions: ${addr2Positions?.length || 0}\n`);

        // 4. Check connection through proxyWallet field
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🔗 CONNECTION BETWEEN ADDRESSES:\n');

        if (addr1Activities?.[0]?.proxyWallet && addr2Activities?.[0]?.proxyWallet) {
            const proxy1 = addr1Activities[0].proxyWallet.toLowerCase();
            const proxy2 = addr2Activities[0].proxyWallet.toLowerCase();

            console.log(`   Address 1 uses proxyWallet: ${proxy1}`);
            console.log(`   Address 2 uses proxyWallet: ${proxy2}\n`);

            if (proxy1 === proxy2) {
                console.log('   ✅ BOTH ADDRESSES LINKED TO ONE PROXY WALLET!\n');
                console.log('   This explains why profiles show the same data.\n');
            } else if (proxy1 === ADDRESS_2.toLowerCase()) {
                console.log('   🎯 CONNECTION FOUND!\n');
                console.log(`   Address 1 (${ADDRESS_1.slice(0, 8)}...) uses`);
                console.log(`   Address 2 (${ADDRESS_2.slice(0, 8)}...) as proxy wallet!\n`);
            } else if (proxy2 === ADDRESS_1.toLowerCase()) {
                console.log('   🎯 CONNECTION FOUND!\n');
                console.log(`   Address 2 (${ADDRESS_2.slice(0, 8)}...) uses`);
                console.log(`   Address 1 (${ADDRESS_1.slice(0, 8)}...) as proxy wallet!\n`);
            } else {
                console.log('   ⚠️  Addresses use different proxy wallets\n');
            }
        }

        // 5. Check through Polymarket username API
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('👤 PROFILE @shbot:\n');

        console.log('   Profile URL options:');
        console.log(`   • https://polymarket.com/@shbot`);
        console.log(`   • https://polymarket.com/profile/${ADDRESS_1}`);
        console.log(`   • https://polymarket.com/profile/${ADDRESS_2}\n`);

        console.log('   💡 Polymarket can link multiple addresses to one profile:');
        console.log('   • Main address (EOA) - for login');
        console.log('   • Proxy address - for trading');
        console.log('   • Username (@shbot) - for public profile\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 6. Final solution
        console.log('✅ SUMMARY AND SOLUTION:\n');

        if (addr2HasData && !addr1HasData) {
            console.log('   🎯 YOUR BOT IS USING THE WRONG ADDRESS!\n');
            console.log('   All trading goes through address:');
            console.log(`   ${ADDRESS_2}\n`);
            console.log('   But .env specifies:');
            console.log(`   ${ADDRESS_1}\n`);
            console.log('   🔧 SOLUTION: Update .env file:\n');
            console.log(`   PROXY_WALLET=${ADDRESS_2}\n`);
        } else if (addr1HasData && !addr2HasData) {
            console.log('   ✅ Bot is working correctly!');
            console.log('   Trading goes through address from .env\n');
            console.log('   But profile @shbot may be linked to a different address.');
            console.log('   This is normal if you recently switched wallets.\n');
        } else if (addr1HasData && addr2HasData) {
            console.log('   ⚠️  Activity on BOTH addresses!\n');
            console.log('   Possible reasons:');
            console.log('   1. You switched wallets');
            console.log('   2. Traded manually from one, with bot from another');
            console.log('   3. Both addresses linked through Polymarket proxy system\n');

            // Compare last trades
            if (addr1Activities?.[0] && addr2Activities?.[0]) {
                const lastTrade1 = new Date(addr1Activities[0].timestamp * 1000);
                const lastTrade2 = new Date(addr2Activities[0].timestamp * 1000);

                console.log('   Last trade:');
                console.log(`   • Address 1: ${lastTrade1.toLocaleString('en-US')}`);
                console.log(`   • Address 2: ${lastTrade2.toLocaleString('en-US')}\n`);

                if (Math.abs(lastTrade1.getTime() - lastTrade2.getTime()) < 60000) {
                    console.log('   ✅ Trades synchronized (< 1 minute difference)');
                    console.log('   Most likely, this is the same account!\n');
                }
            }
        } else {
            console.log('   ❌ No data on any address!\n');
            console.log('   Check address correctness.\n');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
        console.error('❌ Error:', error);
    }
};

checkBothWallets();
