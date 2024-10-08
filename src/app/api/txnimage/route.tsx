// k = number of members who approved the txn
// members who rejected, members who are pending

import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from '@vercel/og';
import { Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as anchor from "@coral-xyz/anchor";

// Assume this function is imported from elsewhere in your project
import * as multisig from "../../../../node_modules/@sqds/multisig/lib/index";

export async function GET(request: NextRequest) {

  const { searchParams } = new URL(request.url);

  const isAddressPresent = searchParams.has('address');
  const address = isAddressPresent ? searchParams.get('address') : 'Dpa2R4pdAtmns4JBpYnMQxJ2oD7ttGmFuB2D1AfYm8TJ';
  const isTxnIndex = searchParams.has('txnIndex');
  const txnIndex = isTxnIndex ? searchParams.get('txnIndex') : "1";

  const connection = new Connection(
    clusterApiUrl("mainnet-beta"),
  );


  const multisigPda = new PublicKey(address!);
    const { Multisig } = multisig.accounts;

    const multisigAccount = await Multisig.fromAccountAddress(
        connection,
        multisigPda
    );

    const [vault_account] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(Number(txnIndex)),
    });

    //   const proposalInfo = await multisig.accounts.Proposal.fromAccountAddress(
    //     connection,
    //     proposal,
    //   )!;
    
    //   const txnStatus = proposalInfo.status.__kind;

    //   const [transaction, txBump] = PublicKey.findProgramAddressSync(
    //     [
    //       Buffer.from("multisig"),
    //       new PublicKey(address!).toBuffer(),
    //       Buffer.from("transaction"),
    //       new anchor.BN(txnIndex!).toArrayLike(Buffer, "le", 8),
    //     ],
    //     multisig.PROGRAM_ID,
    //   );

    //   const transactionInfo =
    // await multisig.accounts.VaultTransaction.fromAccountAddress(
    //   connection,
    //   transaction,
    // )!;

    // let pending = []

    // if(txnStatus!=="Executed" && txnStatus!=="Cancelled"){
    //   const multisigInfo = await fetch(
    //     `https://v4-api.squads.so/multisig/${vault_account.toString()}`,
    //   ).then((res) => res.json());

    //   pending = multisigInfo.account.members.filter(
    //       (x: PublicKey) =>
    //       !proposalInfo.approved.includes(x) || !proposalInfo.rejected.includes(x),
    //   );
    // }
    
    
    // const approvingMembers = proposalInfo.approved.map((key) => key.toBase58()) || ['']
    // const rejectingMembers = proposalInfo.rejected.map((key) => key.toBase58()) || ['']
    // const pendingMembers = pending.map((member: any) => member.key);
    // const members = multisigAccount.members.map((member) => {return member.key.toString()})
    // const threshold = multisigAccount.threshold || 2;

    // console.log({
    //     approvingMembers,
    //     rejectingMembers,
    //     members,
    //     threshold,
    //     pendingMembers
    // })
    let proposalInfo;
    let txnStatus = "";
    let approvingMembers: string[] = [];
    let rejectingMembers: string[] = [];
    let pendingMembers: string[] = [];

    try {
      proposalInfo = await multisig.accounts.Proposal.fromAccountAddress(connection, proposalPda);
      txnStatus = proposalInfo.status.__kind;
      approvingMembers = proposalInfo.approved.map((key) => key.toBase58());
      rejectingMembers = proposalInfo.rejected.map((key) => key.toBase58());
    } catch (error) {
      console.error(error)
    }

    if (txnStatus !== "Executed" && txnStatus !== "Cancelled") {
      try {
        const multisigInfo = await fetch(
          `https://v4-api.squads.so/multisig/${vault_account.toString()}`,
        ).then((res) => res.json());

        const allMembers = multisigInfo.account.members.map((member: any) => member.key);
        pendingMembers = allMembers.filter(
          (member: string) =>
            !approvingMembers.includes(member) && !rejectingMembers.includes(member)
        );
      } catch (error) {
        pendingMembers = []
        console.log(error)
      }
    }

    const members = multisigAccount.members.map((member) => member.key.toString());
    const threshold = multisigAccount.threshold || 2;

    const img = new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontFamily: '"Inter"',
              justifyContent: 'center',
              backgroundColor: 'white',
              fontWeight: 'bold',
            }}
          >
            <div style={{ display: 'flex', fontSize: 48, marginBottom: 40, fontWeight: 900 }}>TRANSACTION #{txnIndex}</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginBottom: 40 }}>
              {[
                { label: 'Approved', value: approvingMembers.length },
                { label: 'Rejected', value: rejectingMembers.length },
                { label: 'Status', value: txnStatus },
                { label: 'Threshold', value: `${threshold}/${members.length}` },
              ].map(({ label, value }, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ 
                    backgroundColor: 'black', 
                    color: 'white', 
                    borderRadius: '50%', 
                    width: 200, 
                    height: 200, 
                    display: 'flex', 
                    flexDirection: 'column',
                    justifyContent: 'center', 
                    alignItems: 'center',
                    marginBottom: 10,
                  }}>
                    <div style={{ fontSize: label === 'Threshold' ? 36 : 48, display: 'flex' }}>{value}</div>
                    {label !== 'Status' && <div style={{ fontSize: 24 , display: 'flex'}}>{label}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 36, marginBottom: 20, display: 'flex' }}>Pending Approvals</div>
            <div 
              style={{ 
                backgroundColor: 'black', 
                color: 'white', 
                padding: 20, 
                borderRadius: 10,
                maxWidth: '90%',
                maxHeight: '50%',
                height:200,
                wordWrap: 'break-word',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {pendingMembers.map((member: any, index: any) => (
                <div key={index} style={{ display: 'flex', fontWeight: 'bold' }}>{member}</div>
              ))}
            </div>
          </div>
        ),
        {
          width: 1000,
          height: 1000,
        },
      );

      const headers = new Headers(img.headers);
      headers.set('Cache-Control', 'no-store, max-age=0');

      return new Response(img.body, {
        headers,
        status: img.status,
        statusText: img.statusText,
      });
}