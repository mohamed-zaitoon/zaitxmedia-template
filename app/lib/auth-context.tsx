"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { getMyProfile } from "./profile-client";
import BiometricVerifyModal from "@/app/components/BiometricVerifyModal";

export interface AuthState {
  user: any;
  loading: boolean;
  signIn: (email?: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email?: string, password?: string, name?: string, whatsapp?: string, country?: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signInWithGoogleIdToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  linkGoogle: () => Promise<{ success: boolean; error?: string }>;
  unlinkGoogle: () => Promise<{ success: boolean; error?: string }>;
  hasGoogleLinked: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  signInWithGoogle: async () => ({ success: false }),
  signInWithGoogleIdToken: async () => ({ success: false }),
  signOut: async () => {},
  signOutUser: async () => {},
  resetPassword: async () => ({ success: false }),
  linkGoogle: async () => ({ success: false }),
  unlinkGoogle: async () => ({ success: false }),
  hasGoogleLinked: false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerkAuth();
  const router = useRouter();

  const [customUser, setCustomUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Biometric state post-login verification
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricUserId, setBiometricUserId] = useState("");
  const [biometricUserEmail, setBiometricUserEmail] = useState("");
  const [biometricUserName, setBiometricUserName] = useState("");
  const [biometricPending, setBiometricPending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function syncUser() {
      if (!clerkLoaded) return;

      if (!clerkUser) {
        if (isMounted) {
          setCustomUser(null);
          setLoading(false);
          setBiometricPending(false);
          setShowBiometricModal(false);
        }
        return;
      }

      try {
        let mergedUser: any = {
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || "",
          name: clerkUser.fullName || "",
          imageUrl: clerkUser.imageUrl || "",
        };

        const profile = await getMyProfile();
        if (profile) mergedUser = { ...mergedUser, ...profile };
        else mergedUser = { ...mergedUser, role: "user" };

        if (isMounted) {
          setCustomUser(mergedUser);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error syncing user with Firestore", error);
        if (isMounted) {
          setCustomUser(null);
          setLoading(false);
        }
      }
    }

    syncUser();

    return () => {
      isMounted = false;
    };
  }, [clerkUser, clerkLoaded]);

  // Check biometric protection for logged-in Clerk / Google users
  useEffect(() => {
    let isMounted = true;

    async function checkBiometricProtection() {
      if (!clerkLoaded || !clerkUser) {
        if (isMounted) {
          setBiometricPending(false);
          setShowBiometricModal(false);
        }
        return;
      }

      const verifiedSession = typeof window !== "undefined"
        ? localStorage.getItem(`biometric_verified_${clerkUser.id}`)
        : null;

      if (verifiedSession === "true") {
        if (isMounted) {
          setBiometricPending(false);
          setShowBiometricModal(false);
        }
        return;
      }

      try {
        const emails = clerkUser.emailAddresses?.map((e: any) => e.emailAddress).filter(Boolean) || [];
        const userEmail = clerkUser.primaryEmailAddress?.emailAddress || emails[0] || "";

        const res = await fetch("/api/auth/passkey/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: clerkUser.id,
            email: userEmail,
            emails,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (data.hasPasskey) {
          if (isMounted) {
            setBiometricUserId(data.matchingUserId || clerkUser.id);
            setBiometricUserEmail(userEmail);
            setBiometricUserName(clerkUser.fullName || userEmail || clerkUser.id);
            setBiometricPending(true);
            setShowBiometricModal(true);
          }
        } else {
          if (isMounted) {
            setBiometricPending(false);
            setShowBiometricModal(false);
          }
        }
      } catch (err) {
        console.warn("Could not check passkey status for user:", err);
        if (isMounted) {
          setBiometricPending(false);
        }
      }
    }

    checkBiometricProtection();

    return () => {
      isMounted = false;
    };
  }, [clerkUser, clerkLoaded]);

  // Fallback stubs for legacy functions, since we use Clerk components for login now
  const signIn = async () => {
    router.push("/login");
    return { success: true };
  };

  const signUp = async () => {
    router.push("/sign-up");
    return { success: true };
  };

  const signInWithGoogle = async () => {
    router.push("/login");
    return { success: true };
  };
  
  const signInWithGoogleIdToken = async () => {
    router.push("/login");
    return { success: true };
  };

  const signOut = async () => {
    if (clerkUser?.id && typeof window !== "undefined") {
      localStorage.removeItem(`biometric_verified_${clerkUser.id}`);
    }
    setBiometricPending(false);
    setShowBiometricModal(false);
    await clerkSignOut();
    router.push("/");
  };

  const resetPassword = async () => {
    router.push("/login");
    return { success: true };
  };

  const linkGoogle = async () => {
    return { success: false, error: "يتم الربط تلقائياً من خلال إعدادات Clerk" };
  };

  const unlinkGoogle = async () => {
    return { success: false, error: "يتم فك الربط من خلال إعدادات Clerk" };
  };

  return (
    <AuthContext.Provider
      value={{
        user: biometricPending ? null : customUser,
        loading: loading || !clerkLoaded || biometricPending,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithGoogleIdToken,
        signOut,
        signOutUser: signOut,
        resetPassword,
        linkGoogle,
        unlinkGoogle,
        hasGoogleLinked: false,
      }}
    >
      {children}

      {/* Post-Login Biometric Verification Modal for User Accounts */}
      <BiometricVerifyModal
        isOpen={showBiometricModal}
        userId={biometricUserId}
        userEmail={biometricUserEmail}
        userName={biometricUserName}
        onSuccess={() => {
          if (clerkUser?.id && typeof window !== "undefined") {
            localStorage.setItem(`biometric_verified_${clerkUser.id}`, "true");
          }
          setBiometricPending(false);
          setShowBiometricModal(false);
        }}
        onCancel={async () => {
          setShowBiometricModal(false);
          setBiometricPending(false);
          if (clerkUser?.id && typeof window !== "undefined") {
            localStorage.removeItem(`biometric_verified_${clerkUser.id}`);
          }
          await clerkSignOut();
          router.push("/login");
        }}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
