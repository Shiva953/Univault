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
    const getTokens = async(): Promise<{label: string, value: string}[]|undefined> => {
      try{
      const resp = await fetch("https://token.jup.ag/strict", {
        method: "GET",
        cache: "force-cache",
        next: {revalidate: 86400},
      })
      const tokens = await resp.json();
      const tokenList = tokens.slice(0, 100).map((token: any) => ({
        label: token.symbol,
        value: token.address
      }));
      return tokenList;
    }
    catch(err){
      console.error(err);
    }
    }

    const tokenList = (await getTokens())!;
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
    let payerAccount: PublicKey;
      try {
        payerAccount = new PublicKey(body.account);
      } catch (err) {
        throw 'Invalid "account" provided';
      }

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
            type: "inline",
            action: {
              title: `Trade`,
              icon: new URL("https://avatars.githubusercontent.com/u/84348534?v=4", requestUrl.origin).toString(),
              description: `Trade via a vault transaction!`,
              label: "Squads",
              type: "action",
              links: {
                actions: [
                  {
                    label: "Trade",
                    href: `${baseHref}?action=trade&amount={tradeAmount}&inputToken={inputToken}&outputToken={outputToken}`,
                    parameters: [
                      {
                        name: "tradeAmount", 
                        label: "Amount to trade",
                        required: true,
                      },
                      {
                        name: "inputToken", 
                        label: "Input Token",
                        options: tokenList,
                        type: "select",
                        required: true,
                      },
                      {
                        name: "outputToken", 
                        label: "Output Token",
                        required: true,
                        type: "select",
                        options: tokenList
                      },
                    ],
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
