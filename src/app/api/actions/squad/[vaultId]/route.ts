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
import { clusterApiUrl, Authorized, Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, TransactionMessage, LAMPORTS_PER_SOL, AddressLookupTableAccount, ComputeBudgetProgram, VersionedMessage, VersionedTransaction } from "@solana/web3.js";
  //@ts-ignore
  import * as multisig from "../../../../../../node_modules/@sqds/multisig/lib/index";

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
      const { action, amount, txnIndexForChecking, w, inputToken, outputToken } = validatedQueryParams(requestUrl); //decoding query params
      
      const body: ActionPostRequest = await req.json(); //the POST request body
      let payerAccount: PublicKey;
        try {
          payerAccount = new PublicKey(body.account);
        } catch (err) {
          throw 'Invalid "account" provided';
        }

      const multisg = params.vaultId;
      multisigPda = new PublicKey(multisg);

      [vault_account] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

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
       
    if(action == "send"){
          const transferInstruction = SystemProgram.transfer({
            fromPubkey: vault_account,
            toPubkey: new PublicKey(w),
            lamports: amount * LAMPORTS_PER_SOL
          }
          );
          const transferMessage = new TransactionMessage({
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
            transactionMessage: transferMessage,
        });
          transaction.add(IX1);
      }

      // if(action == "stake"){
      //   // stake instruction = CREATE KEYPAIR + CREATE STAKE ACCOUNT + DELEGATE TO IT
      //   const minStake = await connection.getStakeMinimumDelegation();
      //   if (amount < minStake.value) {
      //     console.log("minimum stake:", minStake);
      //     return new Response(`Stake Amount should be more than ${minStake.value}`, {
      //       status: 400,
      //       headers: ACTIONS_CORS_HEADERS,
      //   });
      //   }


      //   const minimumRent = await connection.getMinimumBalanceForRentExemption(
      //     StakeProgram.space
      //   );
      //   console.log("MINIMUM RENT: ", minimumRent)
      //   const amountUserWantsToStake = amount * LAMPORTS_PER_SOL; 
      //   const amountToStake = minimumRent + amountUserWantsToStake //this is the ACTUAL AMOUNT TO STAKE

      //   const fundingTxIx = SystemProgram.transfer({
      //     fromPubkey: payerAccount,
      //     toPubkey: stakeKeypair.publicKey,
      //     lamports: minimumRent
      //   })
      //   transaction.add(fundingTxIx)

      //   console.log("LAMPORTS TO BE STAKED BY USER: ", amountToStake)

      // const createStakeAccountIxns = StakeProgram.createAccount({
      //   authorized: new Authorized(vault_account, vault_account), // Here we set two authorities: Stake Authority and Withdrawal Authority. Both are set to our wallet.
      //   fromPubkey: vault_account,
      //   lamports: amountToStake, //AMOUNT OF SOL TO STAKE
      //   // lockup: new Lockup(0, 0, SystemProgram.programId), // Optional. We'll set this to 0 for demonstration purposes.
      //   stakePubkey: stakeKeypair.publicKey,
      // }).instructions;

      // // const s = sendAndConfirmTransaction(connection, createStakeAccountIxns, [payerAccount, stakeKeypair])
      //   let stakeDelegateInstructions:TransactionInstruction[] = StakeProgram.delegate({
      //     stakePubkey: stakeKeypair.publicKey,
      //     authorizedPubkey: vault_account,
      //     votePubkey: new PublicKey("SQDSVTDfE5HqL7D6RjZk1vvZhaheWoskrDdDHCki68w") //SQUADS VALIDATOR
      //   }).instructions;

      //     // const txn = new Transaction().add(
      //     //   StakeProgram.createAccount({
      //     //     stakePubkey: stakeKeypair.publicKey,
      //     //     authorized: new Authorized(vault_account, vault_account),
      //     //     fromPubkey: vault_account,
      //     //     lamports: amountToStake,
      //     //     // note: if you want to time lock the stake account for any time period, this is how
      //     //     // lockup: new Lockup(0, 0, account),
      //     //   }),
      //     //   StakeProgram.delegate({
      //     //     stakePubkey: stakeKeypair.publicKey,
      //     //     authorizedPubkey: vault_account,
      //     //     votePubkey: new PublicKey("SQDSVTDfE5HqL7D6RjZk1vvZhaheWoskrDdDHCki68w"),
      //     //   }),
      //     // );

      //     // const finalStakeIxns = txn.instructions;

      //   const testStakeMessage = new TransactionMessage({
      //     payerKey: vault_account,
      //     recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      //     instructions: [...createStakeAccountIxns, ...stakeDelegateInstructions],
      //   });

      //     const IX2 = multisig.instructions.vaultTransactionCreate({
      //       multisigPda,
      //       transactionIndex: BigInt(Number(txnIndex) + 1),
      //       creator: payerAccount,
      //       vaultIndex: 0,
      //       ephemeralSigners: 1,
      //       transactionMessage: testStakeMessage,
      //     });
      //     // const IX2 = await multisig.rpc.vaultTransactionCreate({
      //     //   connection, 
      //     //   feePayer: stakeKeypair,
      //     //   multisigPda,
      //     //   transactionIndex: BigInt(Number(txnIndex) + 1),
      //     //   creator: payerAccount,
      //     //   vaultIndex: 0,
      //     //   ephemeralSigners: 1,
      //     //   transactionMessage: testStakeMessage,
      //     //   signers: [stakeKeypair]
      //     // });
      //     // const ins = await connection.getSignaturesForAddress

      //   transaction.add(IX2);
      // }

      if(action == "trade"){
        const tokenData: any = await connection.getParsedAccountInfo(new PublicKey(inputToken));
        const decimals: number = tokenData.value?.data?.parsed.info.decimals || 2;

        const tradeAmount = Math.floor(amount * (10 ** decimals));
        const quoteResponse = await ( await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputToken}&outputMint=${outputToken}&amount=${tradeAmount}&slippageBps=50`)).json();

        const instructions = await (
          await fetch('https://quote-api.jup.ag/v6/swap-instructions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              quoteResponse,
              userPublicKey: vault_account.toBase58(),
              wrapUnwrapSOL: false,
              dynamicComputeUnitLimit: false,
              prioritizationFeeLamports: 'auto'
            })
          })
        ).json();
        
        if (instructions.error) {
          throw new Error("Failed to get swap instructions: " + instructions.error);
        }
        
        const {
          tokenLedgerInstruction, // If you are using `useTokenLedger = true`.
          computeBudgetInstructions, // The necessary instructions to setup the compute budget.
          setupInstructions, // Setup missing ATA for the users.
          swapInstruction: swapInstructionPayload, // The actual swap instruction.
          cleanupInstruction, // Unwrap the SOL if `wrapAndUnwrapSol = true`.
          addressLookupTableAddresses, // The lookup table addresses that you can use if you are using versioned transaction.
        } = instructions;
        
        const deserializeInstruction = (instruction: any) => {
          return new TransactionInstruction({
            programId: new PublicKey(instruction.programId),
            keys: instruction.accounts.map((key: any) => ({
              pubkey: new PublicKey(key.pubkey),
              isSigner: key.isSigner,
              isWritable: key.isWritable,
            })),
            data: Buffer.from(instruction.data, "base64"),
          });
        };

        //ALTs
        const getAddressLookupTableAccounts = async (
          keys: string[]
        ): Promise<AddressLookupTableAccount[]> => {
          const addressLookupTableAccountInfos =
            await connection.getMultipleAccountsInfo(
              keys.map((key) => new PublicKey(key))
            );
        
          return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
            const addressLookupTableAddress = keys[index];
            if (accountInfo) {
              const addressLookupTableAccount = new AddressLookupTableAccount({
                key: new PublicKey(addressLookupTableAddress),
                state: AddressLookupTableAccount.deserialize(accountInfo.data),
              });
              acc.push(addressLookupTableAccount);
            }
        
            return acc;
          }, new Array<AddressLookupTableAccount>());
        };
        
        const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
        
        addressLookupTableAccounts.push(
          ...(await getAddressLookupTableAccounts(addressLookupTableAddresses))
        );
        
        const blockhash = (await connection.getLatestBlockhash()).blockhash;
        const messageV0 = new TransactionMessage({
          payerKey: vault_account,
          recentBlockhash: blockhash,
          instructions: [
            ...computeBudgetInstructions.map(deserializeInstruction),
            deserializeInstruction(swapInstructionPayload),
          ],
        }).compileToV0Message(addressLookupTableAccounts);
        // const swaptxn = new VersionedTransaction(messageV0).serialize();
        const finalSwapMessage = TransactionMessage.decompile(messageV0, {addressLookupTableAccounts: addressLookupTableAccounts});

        // const swapMessage = new TransactionMessage({
        //   payerKey: vault_account,
        //   recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        //   instructions: [...finalSwapInstructions],
        // });

          const swapVaultIxn = multisig.instructions.vaultTransactionCreate({
            multisigPda,
            transactionIndex: BigInt(Number(txnIndex) + 1),
            creator: payerAccount,
            vaultIndex: 0,
            ephemeralSigners: 1,
            transactionMessage: finalSwapMessage,
          });

          transaction.add(swapVaultIxn)
      }

      if(action == "deposit"){
        const ixn = SystemProgram.transfer({
          fromPubkey: payerAccount,
          toPubkey: vault_account,
          lamports: amount * LAMPORTS_PER_SOL
        })
        transaction.add(ixn)
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

      const imageUrl = new URL(
        `/api/txnimage?address=${multisigPda.toString()}&txnIndex=${finalTxnIndex}`,
        requestUrl.origin,
      ).toString();
      
        let payload: ActionPostResponse = await createPostResponse({
          fields: {
            transaction,
            message: `Transaction Successful`,
            links: (action!=="deposit" ? ({
              next: {
                type: "inline",
                action: {
                  title: `Vote on Transaction #${finalTxnIndex}`,
                  icon: imageUrl,
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
            }) : undefined)
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
    let inputToken = 'So11111111111111111111111111111111111111112', outputToken='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
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
    if(requestUrl.searchParams.get("inputToken")){
      inputToken = requestUrl.searchParams.get("inputToken")!
    }
    if(requestUrl.searchParams.get("outputToken")){
      outputToken = requestUrl.searchParams.get("outputToken")!
    }
    return { action, amount, txnIndexForChecking, w, inputToken, outputToken };
  }