/**
 * Real Stacks integration. This is what actually talks to a wallet
 * extension and to the deployed market-pool contract. Everything in
 * the UI should route through these functions instead of touching
 * @stacks/connect directly, so there's one place to update if the
 * library's API shifts.
 *
 * Before this works for real, deploy market-pool.clar (see the
 * contracts folder) to testnet or mainnet and paste the resulting
 * address and name into CONTRACT_ADDRESS and CONTRACT_NAME below.
 */

import { AppConfig, UserSession, showConnect, openContractCall } from "@stacks/connect";
import { uintCV, boolCV, PostConditionMode } from "@stacks/transactions";
import { StacksTestnet, StacksMainnet } from "@stacks/network";

// Flip this to StacksMainnet() once you deploy for real.
export const NETWORK = new StacksTestnet();
const IS_MAINNET = false;

// Fill these in after `clarinet deployments generate` or a manual deploy.
const CONTRACT_ADDRESS = "ST000000000000000000002AMW42H";
const CONTRACT_NAME = "market-pool";

const appConfig = new AppConfig(["store_write"]);
export const userSession = new UserSession({ appConfig });

export function isSignedIn() {
  return userSession.isUserSignedIn();
}

export function getUserAddress() {
  if (!userSession.isUserSignedIn()) return null;
  const profile = userSession.loadUserData().profile;
  return IS_MAINNET ? profile.stxAddress.mainnet : profile.stxAddress.testnet;
}

export function signOut() {
  userSession.signUserOut();
}

/**
 * Opens the wallet picker. onFinish receives the signed in session,
 * onCancel fires if the person closes the prompt without connecting.
 */
export function connectWallet({ onFinish, onCancel }) {
  showConnect({
    appDetails: {
      name: "Verdict",
      icon: typeof window !== "undefined" ? `${window.location.origin}/icon.png` : "",
    },
    userSession,
    onFinish,
    onCancel,
  });
}

/**
 * Places a bet on chain. amountMicroStx is in the smallest unit,
 * so 1 STX is 1000000. Swap this for sBTC transfer semantics once
 * the sBTC contract calls are wired in, the shape stays the same.
 */
export function placeBet({ side, amountMicroStx, onFinish, onCancel }) {
  return openContractCall({
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "place-bet",
    functionArgs: [boolCV(side === "yes"), uintCV(amountMicroStx)],
    postConditionMode: PostConditionMode.Allow,
    onFinish,
    onCancel,
  });
}

// Admin only in practice, gate this behind your resolver check
// before exposing any button that calls it.
export function resolveMarket({ outcome, onFinish, onCancel }) {
  return openContractCall({
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "resolve",
    functionArgs: [boolCV(outcome === "yes")],
    onFinish,
    onCancel,
  });
}

export function claimPayout({ onFinish, onCancel }) {
  return openContractCall({
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "claim",
    functionArgs: [],
    onFinish,
    onCancel,
  });
}
