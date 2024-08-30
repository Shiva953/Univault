import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from '@vercel/og';
import { Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { GeistSans } from 'geist/font/sans';

// Assume this function is imported from elsewhere in your project
import * as multisig from "../../../../node_modules/@sqds/multisig/lib/index";

export const getPriceInUSDC = async (amount: number): Promise<number|undefined> => {
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const address = searchParams.get('address');

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

    console.log(address)

    const [vault_account] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      const vault = vault_account.toString()
    

  if (!address) {
    return new NextResponse('Missing address or threshold', { status: 400 });
  }

  const members = multisigAccount.members.map((member) => {return member.key.toString()})
  const threshold = multisigAccount.threshold;
  const balance = (await connection.getBalance(vault_account))/LAMPORTS_PER_SOL;
  const USDBalance = (await getPriceInUSDC(balance) || 0).toFixed(2);
  console.log(members)

  return new ImageResponse(
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
        <h2 style={{ fontSize: '64px', marginBottom: '40px', fontWeight: '800', marginBlockEnd: "4" }}>${USDBalance}</h2>
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
}

// export function generateImageUrl(requestUrl: URL, multisigPda: string, threshold: string): string {
//   return new URL(
//     `/api/vaultimage?address=${multisigPda}`,
//     requestUrl.origin
//   ).toString();
// }