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
            title: `UniVault`,
            icon: new URL("https://i.postimg.cc/J0WVk0p1/squads-blink-intro.png", requestUrl.origin).toString(),
            description: `View your vault, perform squads actions and vote on transactions!`,
            label: "Squads",
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
        let message = "Invalid Multisig PDA";
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

      const requestUrl = new URL(req.url);
      const { multisigAddress } = validatedQueryParams(requestUrl)
  
      let account: PublicKey;
      try {
        account = new PublicKey(body.account);
        console.log(account)
      } catch (err) {
        throw 'Invalid "account" provided';
      }
  
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

      const multisigInfo = await fetch(
        `https://v4-api.squads.so/multisig/${vault_account.toString()}`,
      ).then((res) => res.json());
      const metadata = multisigInfo.metadata;
      const name = metadata.name || '';
      const description = metadata.description || '';

      const baseHref = new URL(
        `/api/actions/squad/${multisigAddress}`,
        requestUrl.origin
      ).toString();
      console.log("BASE HREF: ", baseHref)

      const imageUrl = new URL(
        `/api/vaultimage?address=${multisigPda.toString()}`,
        requestUrl.origin,
      ).toString();
  
  
      const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction,
          message: "Displaying Vault",
          links: {
            next: {
              type: "inline", // This HAS to be INLINE, because we dont want any tx data INITIALLY & just want to take the multisig PDA input
              action: {
                title: `${name}`,
                icon: imageUrl,
                description: `${vault_account.toString()}`,
                label: "Squads",
                type: "action",
                links: {
                  actions: [
                    {
                      label: "Send",
                      href: `/api/actions/squad/send?multisigPda=${multisigPda.toString()}`,
                    },
                    {
                      label: "Stake",
                      href: `/api/actions/squad/stake?multisigPda=${multisigPda.toString()}`,
                  },
                  {
                    label: "Deposit",
                    href: `/api/actions/squad/deposit?multisigPda=${multisigPda.toString()}`,
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
                },
                  ],
                },
              }
            },
          },
        },
      });
  
      return Response.json(payload, {
        headers: ACTIONS_CORS_HEADERS,
      });
    } catch (err) {
      console.log(err);
      let actionError: ActionError = { message: "Failed to fetch blink" };
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