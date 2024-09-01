import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from '@vercel/og';
import { Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL, StakeProgram, GetProgramAccountsResponse } from '@solana/web3.js';
import { GeistSans } from 'geist/font/sans';

// Assume this function is imported from elsewhere in your project
import * as multisig from "../../../../node_modules/@sqds/multisig/lib/index";
import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';

const getPriceInUSDC = async (amount: number): Promise<number|undefined> => {
    try{
      const res = await fetch(`https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112&vsToken=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
      const data = await res.json();
      const price = ((data.data["So11111111111111111111111111111111111111112"]?.price * amount)) || 0;
      return price;
      }
      catch(err){
        console.log(err)
      }
    }

    async function getTokenBalanceWeb3(connection: Connection, tokenAccount: PublicKey) {
      const info = await connection.getTokenAccountBalance(tokenAccount);
      if (info.value.uiAmount == null) throw new Error('No balance found');
      console.log('Balance (using Solana-Web3.js): ', info.value.uiAmount);
      return info.value.uiAmount;
  }

export async function GET(request: NextRequest) {

  const { searchParams } = new URL(request.url);

  const isAddressPresent = searchParams.has('address');
  const address = isAddressPresent ? searchParams.get('address') : 'Dpa2R4pdAtmns4JBpYnMQxJ2oD7ttGmFuB2D1AfYm8TJ';

  const connection = new Connection(
    clusterApiUrl("mainnet-beta"),
  );

  const multisigPda = new PublicKey(address!);
    const {
        Multisig
    } = multisig.accounts;
    const multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
    );

    const [vault_account] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });
    

  if (!address) {
    return new NextResponse('Missing address or threshold', { status: 400 });
  }

  let members = [], threshold = 2, USDBalance = 0.00, finalTotalBalance=0;
  try{
      members = multisigAccount.members.map((member) => {return member.key.toString()})
      threshold = multisigAccount.threshold;
      // total balance = sol balance + staked sol balance + token accounts balance
      const balance = (await connection.getBalance(vault_account))/LAMPORTS_PER_SOL;
      USDBalance = (await getPriceInUSDC(balance) || 0);

      let tokenAccounts:GetProgramAccountsResponse=[], stakeAccounts:GetProgramAccountsResponse=[];
      try{
        tokenAccounts = (await connection.getTokenAccountsByOwner(vault_account, {
          programId: TOKEN_PROGRAM_ID,
        })).value || []
      }
      catch(err){
        console.log(err);
      }
      try{
      stakeAccounts = (await connection.getTokenAccountsByOwner(vault_account, {
        programId: StakeProgram.programId
      })).value || []
    }
    catch(err){
      console.error(err);
    }
      tokenAccounts.concat(stakeAccounts)
      let tokenBalances = 0;
      for (let tokenAccount of tokenAccounts){
        const token_balance = await getTokenBalanceWeb3(connection, tokenAccount.pubkey) || 0;
        tokenBalances += (token_balance);
      }

      finalTotalBalance = USDBalance + tokenBalances;
      console.log(finalTotalBalance)
  } catch(err){
      return new NextResponse('Unable to get vault data', { status: 400 });
  }

  const img = new ImageResponse(
    (
      <div
        style={{
          width: '900px',
          height: '900px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'black',
          color: 'white',
          fontFamily: GeistSans.style.fontFamily,
        }}
      >
        <h2 style={{ fontSize: '64px', marginBottom: '40px', fontWeight: '900', marginBlockEnd: "4" }}>${finalTotalBalance.toFixed(2)}</h2>
        <h1 style={{ fontSize: '64px', marginBottom: '40px', fontWeight: '800' }}>MEMBERS</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px' }}>
          {members.map((member, index) => (
            <div
              key={index}
              style={{
                backgroundColor: 'white',
                color: 'black',
                padding: '15px 20px',
                borderRadius: '25px',
                marginBottom: '20px',
                fontSize: '18px',
                width: '100%',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: '500',
              }}
            >
              {member}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px', marginTop: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '48px', fontWeight: '700' }}>
            <span>{members.length}</span>
            <span style={{ fontSize: '36px', fontWeight: '500' }}>Members</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '48px', fontWeight: '700', textAlign: 'right' }}>
            <span>{threshold}/{members.length}</span>
            <span style={{ fontSize: '36px', fontWeight: '500' }}>Threshold</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 900,
      height: 900,
    }
)

  const headers = new Headers(img.headers);
  headers.set('Cache-Control', 'no-store, max-age=0');

  return new Response(img.body, {
    headers,
    status: img.status,
    statusText: img.statusText,
  });
}