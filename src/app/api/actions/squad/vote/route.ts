// this blink would be for the vote txn afer the initial squads txn[approve, approve and execute(final txn)]
import {
    createActionHeaders,
    NextActionPostRequest,
    ActionError,
    CompletedAction,
    ACTIONS_CORS_HEADERS,
    ActionGetRequest,
    ActionGetResponse,
    ActionPostRequest,
    ActionPostResponse,
    createPostResponse,
  } from "@solana/actions";
  import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, TransactionMessage, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";
    //@ts-ignore
    import * as multisig from "../../../../../../node_modules/@sqds/multisig/lib/index";
    import * as anchor from "@coral-xyz/anchor";
    import { redirect } from "next/navigation";
    import { NextActionLink } from "@solana/actions-spec";

export const GET = async (req: Request) => {
    return Response.json({ message: "Method not supported" } as ActionError, {
        status: 403,
        headers: ACTIONS_CORS_HEADERS,
    });
};

export const POST = async (req: Request) => {
    try {
        const requestUrl = new URL(req.url);
        
        const { m, txnIndex, action } = validatedQueryParams(requestUrl); //decoding query params
        const multisigPda = new PublicKey(m);

        const body: ActionPostRequest = await req.json(); //the POST request body
        let payerAccount: PublicKey;
        try {
          payerAccount = new PublicKey(body.account);
        } catch (err) {
          return new Response('Invalid "account" provided', {
            status: 400,
            headers: ACTIONS_CORS_HEADERS,
          });
        }

        const connection = new Connection(
          `https://mainnet.helius-rpc.com/?api-key=${process.env.SOLANA_RPC!}` || clusterApiUrl("mainnet-beta"),
        );

        const transaction = new Transaction();

        const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
          connection,
          multisigPda
        );

        //LAST TRANSACTION INDEX(FOR THE LATEST TRANSACTION)
        
        const transactionIndexBN = multisigInfo.transactionIndex;
        let index = Number(transactionIndexBN);

        if(txnIndex && txnIndex!=0){
          index = txnIndex;
        }

        const transactionPda = multisig.getTransactionPda({
          multisigPda,
          index: BigInt(index),
        });
        const proposalPda = multisig.getProposalPda({
            multisigPda,
            transactionIndex: BigInt(index),
          });

          let proposal;
          try {
            proposal = await multisig.accounts.Proposal.fromAccountAddress(
              connection,
              proposalPda[0]
            );
          } catch (error) {
            proposal = null;
          }
          const proposalStatus = proposal?.status.__kind || "None";
          console.log("INITAL STATUS:", proposalStatus)
          if(proposalStatus === "None"){
            transaction.add(
              multisig.instructions.proposalCreate({
                multisigPda,
                creator: payerAccount,
                transactionIndex: BigInt(index),
              })
            )
          }
          if(proposalStatus === "Draft"){
              transaction.add(
                multisig.instructions.proposalActivate({
                  multisigPda,
                  transactionIndex: BigInt(index),
                  member: payerAccount
                })
              )
          }

          console.log("CURRENT STATUS:", proposalStatus)
          if(action === "approve"){
            console.log("STATUS inside approve:", proposalStatus)
            transaction.add(
              multisig.instructions.proposalApprove({
                multisigPda, 
                transactionIndex: BigInt(index),
                member: payerAccount
              })
            )
          }
          if(action === "execute"){
            console.log("STATUS inside execute:", proposalStatus)
            transaction.add(
              (await multisig.instructions.vaultTransactionExecute({
                connection,
                multisigPda,
                transactionIndex: BigInt(index),
                member: payerAccount,
              })).instruction
            )

          }
          if(action === "reject"){
            console.log("STATUS inside reject:", proposalStatus)
            multisig.instructions.proposalReject({
              multisigPda,
              transactionIndex: BigInt(index),
              member: payerAccount
            })
          }
          if(action === "approveandexecute"){
            console.log("STATUS inside ApproveExecute:", proposalStatus)
            transaction.add(
              (multisig.instructions.proposalApprove({
                multisigPda, 
                transactionIndex: BigInt(index),
                member: payerAccount
              })),
              ((await multisig.instructions.vaultTransactionExecute({
                connection,
                multisigPda,
                transactionIndex: BigInt(index),
                member: payerAccount,
              })).instruction)
            )
          }

          transaction.feePayer = payerAccount;
          transaction.recentBlockhash = (
            await connection.getLatestBlockhash()
          ).blockhash;
          

          const payload: ActionPostResponse = await createPostResponse({
            fields: {
              transaction,
              // HERE, ON SUCCESSFUL TXN REDIRECT TO THE 2ND BLINK WHERE YOU WERE TAKING THE TXN INDEX
              // OR REFRESH???
              message: `${
                action === "approve"
                  ? "Vote Approved" 
                  : action === "reject"
                  ? "Rejected"
                  : action == "approveandexecute"
                  ? "Approved and Executed"
                  : "Vault Transaction Finally Executed!"
              } transaction #${BigInt(index)}`,
               links: {
                next: {
                  type: "post",
                  href: `/api/actions/squad?address=${multisigPda.toString()}`
                }
               }
            },
            // note: no additional signers are needed
            // signers: [],
          });
      
          return Response.json(payload, {
            headers: ACTIONS_CORS_HEADERS,
          });

    } catch(err){

    }
}

export const OPTIONS = async (req: Request) => {
    return new Response(null, {
      status: 204,
      headers: ACTIONS_CORS_HEADERS,
    });
  };

  function validatedQueryParams(requestUrl: URL){
    let action = 'vote';
    let m = '', txnIndex = 0;
    try {
        if (requestUrl.searchParams.get("action")) {
          action = requestUrl.searchParams.get("action")!;
        }
      } catch (err) {
        throw "Invalid input query parameters";
      }
      try {
        if (requestUrl.searchParams.get("multisigPda")) {
          m = requestUrl.searchParams.get("multisigPda")!;
        }
      } catch (err) {
        throw "Invalid input query parameters";
      }
        if (requestUrl.searchParams.get("txnIndex")) {
          txnIndex = Number(requestUrl.searchParams.get("txnIndex")!);
        }
      return { m, txnIndex, action }
  }