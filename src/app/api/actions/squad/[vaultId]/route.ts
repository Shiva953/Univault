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
import { clusterApiUrl, Authorized, Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, TransactionMessage, LAMPORTS_PER_SOL, ComputeBudgetProgram, StakeInstruction, StakeProgram, Lockup, Keypair } from "@solana/web3.js";
  //@ts-ignore
  import * as multisig from "../../../../../../node_modules/@sqds/multisig/lib/index";
  import { NextActionLink } from "@solana/actions-spec";

  // N blinks(linked through action chaining)
  // Blink 1 - Accept multisig PDA address
  // Blink 2 - Show Vault Info + Stake/Send/Deposit Options, on click executing first txn
  // Blink 3 - Show Voting option(considering 2/3 multisig you need 2 votes, 1 was already done if blink 2 txn was executed by a multisig member)
  // for blink 3, finally you have approve and execute

  // TODAY
  // TEST A TYPICAL SQUADS TXN[CREATE + VOTE ON ITS EXECUTION + FINALLY EXECUTE]
  // CREATE BLINK 1 + HALF OF BLINK 2

  let vault_account: PublicKey;
  let multisigPda: PublicKey;

  export const GET = async (req: Request) => {
    return Response.json({ message: "Method not supported" } as ActionError, {
      status: 403,
      headers: ACTIONS_CORS_HEADERS,
    });
  };

  export const POST = async (req: Request,
    { params }: { params: { vaultId: string } }
  ) => {
    try {
      const requestUrl = new URL(req.url);
      const { action, amount, txnIndexForChecking, w } = validatedQueryParams(requestUrl); //decoding query params
      
      const body: ActionPostRequest = await req.json(); //the POST request body
      const payerAccount = new PublicKey(body.account);

      const multisg = params.vaultId;
      console.log(multisg)
      multisigPda = new PublicKey(multisg);

      [vault_account] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      console.log("VAULT ACCOUNT: ", vault_account)

      //get the base href from the frontend
      const baseHref = new URL(
        `/api/actions/squad/${multisg}`,
        requestUrl.origin
      ).toString();
      console.log("BASE HREF: ", baseHref)

      const connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${process.env.SOLANA_RPC!}` || clusterApiUrl("mainnet-beta"),
      );
      
      // SQUADS SEND TXN INSTRUCTION =
      // vaultTransactionCreate(include the transfer/stake instruction in it) + (USER FIRST GOES TO VOTE)
      // [if(proposalStatus = "None") -> proposalCreate else if(proposalStatus = "Draft") -> proposalActivate finally proposalApprove]
      // ... + [if (majority threshold) -> vaultTransactionExecute()]
    let transaction = new Transaction();
    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    const txnIndex = multisigInfo.transactionIndex;
    console.log("txn index: ", txnIndex);

      let finalTxnIndex;
      if(txnIndexForChecking && txnIndexForChecking!=0){
        finalTxnIndex = txnIndexForChecking;
      }
      else{
        finalTxnIndex = Number(multisigInfo.transactionIndex) + 1;
      }

      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: BigInt(finalTxnIndex),
      });

       
    if(action == "send"){
          const transferInstruction = SystemProgram.transfer({
            fromPubkey: vault_account,
            toPubkey: new PublicKey(w),
            lamports: amount * LAMPORTS_PER_SOL
          }
          );

        const testTransferMessage = new TransactionMessage({
          payerKey: vault_account,
          recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
          instructions: [transferInstruction],
          });
          const IX1 = multisig.instructions.vaultTransactionCreate({
            multisigPda,
            transactionIndex: BigInt(Number(txnIndex) + 1),
            creator: payerAccount,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: testTransferMessage,
        });
          transaction.add(IX1);
      }

      const stakeKeypair = Keypair.generate();
      console.log(stakeKeypair.publicKey)
      if(action == "stake"){
        // stake instruction = CREATE KEYPAIR + CREATE STAKE ACCOUNT + DELEGATE TO IT
        // This is NOT the stake account, but required for its creation

        const minStake = await connection.getStakeMinimumDelegation();
        // if (amount < minStake.value) {
        //   console.log("minimum stake:", minStake);
        //   return new Response(`Stake Amount should be more than ${minStake.value}`, {
        //     status: 400,
        //     headers: ACTIONS_CORS_HEADERS,
        // });
        // }


        const minimumRent = await connection.getMinimumBalanceForRentExemption(
          StakeProgram.space
        );
        console.log("MINIMUM RENT: ", minimumRent)
        const amountUserWantsToStake = amount * LAMPORTS_PER_SOL; 
        const amountToStake = minimumRent + amountUserWantsToStake //this is the ACTUAL AMOUNT TO STAKE

        const fundingTxIx = SystemProgram.transfer({
          fromPubkey: payerAccount,
          toPubkey: stakeKeypair.publicKey,
          lamports: minimumRent
        })
        transaction.add(fundingTxIx)

        console.log("LAMPORTS TO BE STAKED BY USER: ", amountToStake)

      // const createStakeAccountIxns = StakeProgram.createAccount({
      //   authorized: new Authorized(vault_account, vault_account), // Here we set two authorities: Stake Authority and Withdrawal Authority. Both are set to our wallet.
      //   fromPubkey: vault_account,
      //   lamports: amountToStake, //AMOUNT OF SOL TO STAKE
      //   // lockup: new Lockup(0, 0, SystemProgram.programId), // Optional. We'll set this to 0 for demonstration purposes.
      //   stakePubkey: stakeKeypair.publicKey,
      // }).instructions;

      //   let stakeInstructions:TransactionInstruction[] = StakeProgram.delegate({
      //     stakePubkey: stakeKeypair.publicKey,
      //     authorizedPubkey: vault_account,
      //     votePubkey: new PublicKey("SQDSVTDfE5HqL7D6RjZk1vvZhaheWoskrDdDHCki68w") //SQUADS VALIDATOR PUBKEY
      //   }).instructions;

          const txn = new Transaction().add(
            StakeProgram.createAccount({
              stakePubkey: stakeKeypair.publicKey,
              authorized: new Authorized(vault_account, vault_account),
              fromPubkey: vault_account,
              lamports: amountToStake,
              // note: if you want to time lock the stake account for any time period, this is how
              // lockup: new Lockup(0, 0, account),
            }),
            StakeProgram.delegate({
              stakePubkey: stakeKeypair.publicKey,
              authorizedPubkey: vault_account,
              votePubkey: new PublicKey("SQDSVTDfE5HqL7D6RjZk1vvZhaheWoskrDdDHCki68w"),
            }),
          );
          txn.recentBlockhash = (
            await connection.getLatestBlockhash()
          ).blockhash;
          txn.feePayer = payerAccount;
          txn.partialSign(stakeKeypair)
          const finalStakeIxns = txn.instructions;

        const testStakeMessage = new TransactionMessage({
          payerKey: vault_account,
          recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
          instructions: [...finalStakeIxns],
        });

          const IX2 = multisig.instructions.vaultTransactionCreate({
            multisigPda,
            transactionIndex: BigInt(Number(txnIndex) + 1),
            creator: payerAccount,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: testStakeMessage,
          });

        transaction.add(...finalStakeIxns);
      }

      if(action=="goToTxnIndex"){
        console.log(`GOING TO TXN INDEX #${txnIndexForChecking}`)
        transaction.add(SystemProgram.transfer({
          fromPubkey: payerAccount,
          toPubkey: payerAccount,
          lamports: 0
        }
        ))
      }
      

      transaction.feePayer = payerAccount;
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;
      

        let payload: ActionPostResponse = await createPostResponse({
          fields: {
            transaction,
            message: `SUCCESSFUL FIRST ${action} TRANSACTION`,
            links: {
              next: {
                type: "inline",
                action: {
                  title: `Vote on Transaction #${finalTxnIndex}`,
                  icon: new URL("https://avatars.githubusercontent.com/u/84348534?v=4", requestUrl.origin).toString(),
                  description: ``,
                  label: "Squads",
                  type: "action",
                  links: {
                    actions: [
                      {
                        label: "Vote(Approve)",
                        href: `/api/actions/squad/vote?multisigPda=${multisigPda.toString()}&txnIndex=${finalTxnIndex}&action=approve`,
                      },
                      {
                        label: "Execute",
                        href: `/api/actions/squad/vote?multisigPda=${multisigPda.toString()}&txnIndex=${finalTxnIndex}&action=execute`
                      },
                      {
                        label: "Reject",
                        href: `/api/actions/squad/vote?multisigPda=${multisigPda.toString()}&txnIndex=${finalTxnIndex}&action=reject`,
                      },
                      {
                        label: "Approve and Execute",
                        href: `/api/actions/squad/vote?multisigPda=${multisigPda.toBase58()}&txnIndex=${finalTxnIndex}&action=approveandexecute`,
                      },
                    ],
                  },
                }
              }
            }
          },
          // signers: (action == "stake") ? [stakeKeypair] : undefined
        });
      
        return Response.json(payload, {
          headers: ACTIONS_CORS_HEADERS,
        });
    } catch (err) {
        console.log(err);
        let message = "An unknown error occurred";
        if (typeof err == "string") message = err;
        return new Response(JSON.stringify(message), {
            status: 400,
            headers: ACTIONS_CORS_HEADERS,
        });
    }
  };

  // DO NOT FORGET TO INCLUDE THE `OPTIONS` HTTP METHOD
  // THIS WILL ENSURE CORS WORKS FOR BLINKS
  export const OPTIONS = async (req: Request) => {
    return new Response(null, {
      status: 204,
      headers: ACTIONS_CORS_HEADERS,
    });
  };

  function validatedQueryParams(requestUrl: URL) {
    let action;
    let amount = 0.001;
    let txnIndexForChecking = 0;
    let w = '792FsxG2Co6rDAwudPCW1bJp8VwkzVThdSGPPZJpswE5'
    try {
      if (requestUrl.searchParams.get("action")) {
        action = requestUrl.searchParams.get("action")!;
      }
    } catch (err) {
      throw "Invalid input query parameters";
    }
    try {
      if (requestUrl.searchParams.get("amount")) {
        amount = parseFloat(requestUrl.searchParams.get("amount")!);
      }
    } catch (err) {
      throw "Invalid input query parameters";
    }

    if(requestUrl.searchParams.get("txnIndex")){
      txnIndexForChecking = parseInt(requestUrl.searchParams.get("txnIndex")!)
    }
    if(requestUrl.searchParams.get("w")){
      w = requestUrl.searchParams.get("w") || '792FsxG2Co6rDAwudPCW1bJp8VwkzVThdSGPPZJpswE5';
    }
  // const sq = Squads.mainnet();
  // const tx = await sq;
  
    return { action, amount, txnIndexForChecking, w };
  }

  export const getCompletedAction = (stage: string): NextActionLink => {
    return {
      type: "inline",
      action: {
        description: `Action ${stage} completed`,
        icon: `https://action-chaining-example.vercel.app/${stage}.webp`,
        label: `Action ${stage} Label`,
        title: `Action ${stage} completed`,
        type: "completed",
      },
    };
  };
  
  export const getNextAction = (stage: string): NextActionLink => {
    return {
      type: "inline",
      action: {
        description: `Action ${stage}`,
        icon: `https://action-chaining-example.vercel.app/${stage}.webp`,
        label: `Action ${stage} Label`,
        title: `Action ${stage}`,
        type: "action",
        links: {
          actions: [
            {
              label: `Submit ${stage}`, // button text
              href: `/api/action?amount={amount}&stage=${stage}`, // api endpoint
              parameters: [
                {
                  name: "amount", // field name
                  label: "Enter a custom SOL amount", // text input placeholder
                },
              ],
            },
          ],
        },
      },
    };
  };