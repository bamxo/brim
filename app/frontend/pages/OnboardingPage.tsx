// app/frontend/pages/OnboardingPage.tsx
import { useEffect } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import checklistSvg from "../assets/checklist.svg";

type OnboardingStatus = {
  gmailConnected: boolean;
  supplierAdded: boolean;
  reorderConfigured: boolean;
  allComplete: boolean;
};

type LoaderData = { status: OnboardingStatus; shopId: string; forceOnboarding: boolean };

export default function OnboardingPage() {
  const { status, shopId, forceOnboarding } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const { revalidate } = useRevalidator();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "gmail_connected") revalidate();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [revalidate]);

  const handleConnectGmail = () => {
    window.open(
      `${window.location.origin}/auth/google/start?shop_id=${shopId}`,
      "_blank",
    );
  };

  const steps = [
    {
      label: "Connect Gmail and allow access",
      complete: status.gmailConnected,
      cta: "Connect Gmail",
      onAction: handleConnectGmail,
    },
    {
      label: "Connect first supplier",
      complete: status.supplierAdded,
      cta: "Add Supplier",
      onAction: () => navigate("/app/suppliers/new"),
    },
    {
      label: "Configure a product (set reorder point)",
      complete: status.reorderConfigured,
      cta: "Set Reorder Point",
      onAction: () => navigate("/app/products"),
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--s-color-bg-app, #F1F2F3)",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          border: "1px solid var(--s-color-border, #E1E3E5)",
          padding: "32px",
          maxWidth: "640px",
          width: "100%",
          display: "flex",
          gap: "32px",
          alignItems: "center",
        }}
      >
        {/* Left: steps */}
        <div style={{ flex: 1 }}>
          <h2
            style={{
              margin: "0 0 24px",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--s-color-text, #202223)",
            }}
          >
            Get started with Brim
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <StepIndicator complete={step.complete} />
                <span
                  style={{
                    flex: 1,
                    fontSize: "14px",
                    color: step.complete
                      ? "var(--s-color-text-subdued, #6D7175)"
                      : "var(--s-color-text, #202223)",
                    textDecoration: step.complete ? "line-through" : "none",
                  }}
                >
                  {i + 1}. {step.label}
                </span>
                {!step.complete && (
                  <s-button onClick={step.onAction}>
                    {step.cta}
                  </s-button>
                )}
              </div>
            ))}
          </div>

          {forceOnboarding && (
            <div style={{ marginBottom: "16px" }}>
              <s-badge tone="info">Dev preview</s-badge>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {(() => {
              if (!status.gmailConnected) {
                return (
                  <s-button variant="primary" onClick={handleConnectGmail}>
                    Connect Gmail
                  </s-button>
                );
              }
              if (!status.supplierAdded) {
                return (
                  <s-button variant="primary" onClick={() => navigate("/app/suppliers/new")}>
                    Connect Supplier
                  </s-button>
                );
              }
              if (!status.reorderConfigured) {
                return (
                  <s-button variant="primary" onClick={() => navigate("/app/products")}>
                    Set Reorder Point
                  </s-button>
                );
              }
              return null;
            })()}
            <s-link href="#">Quick Tour Video</s-link>
          </div>

          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--s-color-border, #E1E3E5)" }}>
            <s-button
              variant="secondary"
              onClick={() => {
                if (forceOnboarding) {
                  navigate("/app/onboarding");
                } else {
                  navigate("/app/onboarding?force=1");
                }
              }}
            >
              {forceOnboarding ? "Exit preview mode" : "Preview onboarding"}
            </s-button>
          </div>
        </div>

        {/* Right: graphic */}
        <div style={{ flexShrink: 0 }}>
          <img src={checklistSvg} alt="" style={{ width: "160px", height: "auto" }} />
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ complete }: { complete: boolean }) {
  if (complete) {
    return (
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: "#1A7A4C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
          <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        border: "2px solid var(--s-color-border, #E1E3E5)",
        flexShrink: 0,
      }}
    />
  );
}
