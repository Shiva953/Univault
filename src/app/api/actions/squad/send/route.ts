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
  import * as multisig from "../../../../../../node_modules/@sqds/multisig/lib/index";

  export const GET = async (req: Request) => {
    return Response.json({ message: "Method not supported" } as ActionError, {
      status: 403,
      headers: ACTIONS_CORS_HEADERS,
    });
  };

  export const POST = async(req: Request) => {
    const requestUrl = new URL(req.url);
    const { m } = validatedQueryParams(requestUrl); //decoding query params
    const multisigPda = new PublicKey(m);

    const connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${process.env.SOLANA_RPC!}` || clusterApiUrl("mainnet-beta"),
      );

    const baseHref = new URL(
        `/api/actions/squad/${m}`,
        requestUrl.origin
      ).toString();
      console.log("BASE HREF: ", baseHref)

      let [vault_account] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });
    
    const body: ActionPostRequest = await req.json(); //the POST request body
    const payerAccount = new PublicKey(body.account);

    const tx = new Transaction().add(SystemProgram.transfer({
        fromPubkey: payerAccount,
        toPubkey: payerAccount,
        lamports: 0
    }))
    tx.feePayer = payerAccount;
    tx.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

    const payload: ActionPostResponse = await createPostResponse({
        fields: {
          transaction: tx,
          message: "",
          links: {
            next: {
              type: "inline", // This HAS to be INLINE, because we dont want any tx data INITIALLY & just want to take the multisig PDA input
              // href: `/api/actions/squad/${multisigAddress}`
              action: {
                title: `Send from vault`,
                icon: new URL("https://avatars.githubusercontent.com/u/84348534?v=4", requestUrl.origin).toString(),
                description: `Transfer from your vault through a squads txn`,
                label: "Squads",
                type: "action",
                links: {
                  actions: [
                    {
                      label: "Send",
                      // href: `/api/actions/squad/send&multisigPda={}`
                      href: `${baseHref}?action=send&amount={sendAmount}&wallet={w}`, // this href will have a text input
                      parameters: [
                        {
                          name: "sendAmount", 
                          label: "Amount",
                          required: true,
                        },
                        {
                            name: "w", 
                            label: "Wallet Address of Recipient",
                            required: true,
                          },
                      ],
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
    }

  export const OPTIONS = async (req: Request) => {
    return new Response(null, {
      status: 204,
      headers: ACTIONS_CORS_HEADERS,
    });
  };

  function validatedQueryParams(requestUrl: URL){
    let m = ''
    try {
        if (requestUrl.searchParams.get("multisigPda")) {
          m = requestUrl.searchParams.get("multisigPda")!;
        }
      } catch (err) {
        throw "Invalid input query parameters";
      }
      return { m }
  }
