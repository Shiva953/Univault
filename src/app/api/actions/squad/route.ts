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
  import { SystemProgram, clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction, ComputeBudgetProgram } from "@solana/web3.js";
  import * as multisig from "../../../../../node_modules/@sqds/multisig/lib/index";

  //TODO - 
  // MAKE CHAINING BETTER(POSSIBLY MAKE NEW BLINK ROUTES FOR SEND, STAKE, DEPOSIT AND FINALLY CONNECT EACH TO THE VOTE BLINK IN THE END)
  // AVOID UNECESSARY TXNS
  // HANDLE EDGE CASES AND ERROR SCENARIOS

  export const GET = async (req: Request) => {
    try {
        const requestUrl = new URL(req.url);

        const payload: ActionGetResponse = {
            title: `View Your Vault!`,
            icon: new URL("https://avatars.githubusercontent.com/u/84348534?v=4", requestUrl.origin).toString(),
            description: `Multisig PDA Address`,
            label: "Squads", // this value will be ignored since `links.actions` exists
            links: {
              actions: [
                {
                  label: "View Vault",
                  href: `/api/actions/squad?address={multisigAddress}`,
                  parameters: [{
                    name: "multisigAddress",
                    label: "Multisig PDA",
                    required: true
                  }]
                },
              ],
            },
          };
      
          return Response.json(payload, {
            headers: ACTIONS_CORS_HEADERS,
          });
    }
    catch(err){
        console.log(err);
        let message = "An unknown error occurred";
        if (typeof err == "string") message = err;
        return new Response(message, {
          status: 400,
          headers: ACTIONS_CORS_HEADERS,
        });
      }
}

export const POST = async (req: Request) => {
    try {
      const body: ActionPostRequest = await req.json();
      // body will contain the user's `account` and `memo` input from the user
      console.log("body:", body);

      const requestUrl = new URL(req.url);
      console.log(requestUrl)
      const { multisigAddress } = validatedQueryParams(requestUrl)
      console.log(multisigAddress)
  
      let account: PublicKey;
      try {
        account = new PublicKey(body.account);
        console.log(account)
      } catch (err) {
        throw 'Invalid "account" provided';
      }
  
      // read in the user input `memo` value
      // todo: see note above on `body`
      const connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${process.env.SOLANA_RPC!}` || clusterApiUrl("mainnet-beta"),
      );
  
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: account,
          toPubkey: account,
          lamports: 0,
        })
      );
  
      // set the end user as the fee payer
      transaction.feePayer = account;
  
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      let multisigPda = new PublicKey(multisigAddress);

      let [vault_account] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });
      console.log("VAULT ACCOUNT: ", vault_account)

      const multisigInfo = await fetch(
        `https://v4-api.squads.so/multisig/${vault_account.toString()}`,
      ).then((res) => res.json());
      const metadata = multisigInfo.metadata;
      const name = metadata.name || '';
      const description = metadata.description || '';

      //get the base href from the frontend
      const baseHref = new URL(
        `/api/actions/squad/${multisigAddress}`,
        requestUrl.origin
      ).toString();
      console.log("BASE HREF: ", baseHref)
  
      // if type of next blink == post then you cant already have a blink(except if its in GET)
      const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction,
          message: "Displaying Vault",
          links: {
            next: {
              type: "inline", // This HAS to be INLINE, because we dont want any tx data INITIALLY & just want to take the multisig PDA input
              // href: `/api/actions/squad/${multisigAddress}`
              action: {
                title: `${name} ${vault_account.toString()}`,
                icon: new URL("https://avatars.githubusercontent.com/u/84348534?v=4", requestUrl.origin).toString(),
                description: `${description}`,
                label: "Squads",
                type: "action",
                links: {
                  actions: [
                    {
                      label: "Send",
                      href: `/api/actions/squad/send?multisigPda=${multisigPda.toString()}`,
                      // href: `${baseHref}?action=send&amount={sendAmount}`, // this href will have a text input
                      // parameters: [
                      //   {
                      //     name: "sendAmount", 
                      //     label: "Enter amount to send/withdraw",
                      //     required: true,
                      //   },
                      // ],
                    },
                    {
                      label: "Stake",
                      href: `/api/actions/squad/stake?multisigPda=${multisigPda.toString()}`,
                      // parameters: [
                      //   {
                      //     name: "depositAmount", 
                      //     label: "Enter Amount to Stake(using Squads Validator)",
                      //     required: true,
                      //   },],
                  },
                  {
                    label: "Vote",
                    parameters: [
                      {
                        name: "txnIndex", 
                        label: "Vote for transaction at given index",
                        required: true,
                      },],
                      href: `${baseHref}?action=goToTxnIndex&amount=0&txnIndex={txnIndex}`
                    // href: `/api/actions/squad/vote?multisigPda=${multisigPda.toBase58()}&txnIndex=${Number(multisigInfo.transactionIndex) + 1}&action=`
                },
                  ],
                },
              }
            },
          },
        },
        // AFTER THIS ACTION HOWEVER, WE MUST SEND A POST TO RELATED ENDPOINTS FOR SEND, RECEIVE, STAKE
        // no additional signers are required for this transaction
        // signers: [],
      });
  
      return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
      });
    } catch (err) {
      console.log(err);
      let actionError: ActionError = { message: "An unknown error occurred" };
      if (typeof err == "string") actionError.message = err;
      return Response.json(actionError, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  };

  export const OPTIONS = async (req: Request) => {
    return new Response(null, {
      status: 204,
      headers: ACTIONS_CORS_HEADERS,
    });
  };

function validatedQueryParams(requestUrl: URL) {
    let multisigAddress='';
  // const sq = Squads.mainnet();
  // const tx = await sq;
    try {
      if (requestUrl.searchParams.get("address")) {
        multisigAddress = requestUrl.searchParams.get("address")!;
      }
    } catch (err) {
      throw "Invalid input query parameter";
    }
  
    return { multisigAddress };
  }