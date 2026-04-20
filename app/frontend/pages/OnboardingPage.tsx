import { useEffect } from "react";
import { useFetcher, useNavigate, useRevalidator } from "react-router";
import checklistSvg from "../assets/checklist.svg";

type OnboardingStatus = {
  gmailConnected: boolean;
  gmailSkipped: boolean;
  supplierAdded: boolean;
  reorderConfigured: boolean;
  allComplete: boolean;
};

type Props = {
  status: OnboardingStatus;
  shopId: string;
  forceOnboarding: boolean;
};

export default function OnboardingPage({ status, shopId, forceOnboarding }: Props) {
  const navigate = useNavigate();
  const { revalidate } = useRevalidator();
  const fetcher = useFetcher();

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
      label: "Connect Gmail (optional)",
      bullets: [
        "Send POs from your own address",
        "View supplier replies inside Brim",
      ],
      skippable: true,
      complete: status.gmailConnected || status.gmailSkipped,
      cta: "Connect Gmail",
      onAction: handleConnectGmail,
    },
    {
      label: "Add first supplier",
      bullets: null,
      skippable: false,
      complete: status.supplierAdded,
      cta: "Add supplier",
      onAction: () => navigate("/app/suppliers/new"),
    },
    {
      label: "Configure a product",
      bullets: null,
      skippable: false,
      complete: status.reorderConfigured,
      cta: "Set reorder point",
      onAction: () => navigate("/app/products"),
    },
  ];

  return (
    <div style={{ marginTop: 32, maxWidth: 720, marginLeft: "auto", marginRight: "auto", width: "100%" }}>
      <s-section padding="base">
        <div style={{ padding: "16px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <s-stack direction="block" gap="base">
                <s-stack direction="block" gap="small-200">
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 650,
                      lineHeight: "28px",
                      color: "var(--s-color-text, #202223)",
                    }}
                  >
                    Get started with Brim
                  </h2>
                  <s-text color="subdued">
                    Finish these steps to start automating your reorders.
                  </s-text>
                </s-stack>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {steps.map((step, i) => {
                    const firstIncomplete = steps.findIndex((s) => !s.complete);
                    const state: "done" | "current" | "upcoming" = step.complete
                      ? "done"
                      : i === firstIncomplete
                      ? "current"
                      : "upcoming";
                    const isLast = i === steps.length - 1;
                    const nextState: "done" | "current" | "upcoming" | null = isLast
                      ? null
                      : steps[i + 1].complete
                      ? "done"
                      : i + 1 === firstIncomplete
                      ? "current"
                      : "upcoming";
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            width: 20,
                            flexShrink: 0,
                            alignSelf: "stretch",
                          }}
                        >
                          <StepIndicator state={state} />
                          {!isLast && (
                            <div
                              style={{
                                width: 2,
                                flex: 1,
                                minHeight: 12,
                                margin: "3px 0",
                                background:
                                  state === "done"
                                    ? "#1A7A4C"
                                    : "var(--s-color-border, #E1E3E5)",
                              }}
                            />
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            paddingBottom: isLast ? 0 : 16,
                            whiteSpace: "normal",
                          }}
                        >
                          {/* Label row */}
                          <s-text
                            type={state === "done" ? undefined : "strong"}
                            color={state === "done" ? "subdued" : undefined}
                          >
                            {i + 1}. {step.label}
                          </s-text>

                          {/* Expanded content — only when current */}
                          {state === "current" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {step.bullets && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {step.bullets.map((b, bi) => (
                                    <div
                                      key={bi}
                                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <circle cx="7" cy="7" r="7" fill="#1A7A4C" />
                                        <path
                                          d="M3.5 7L5.8 9.5L10.5 4.5"
                                          stroke="white"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                      <span style={{ fontSize: 13, color: "var(--s-color-text, #202223)" }}>
                                        {b}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <s-button variant="primary" onClick={step.onAction}>
                                  {step.cta}
                                </s-button>
                                {step.skippable && (
                                  <a
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const fd = new FormData();
                                      fd.append("intent", "skip-gmail");
                                      fetcher.submit(fd, { method: "post" });
                                    }}
                                    style={{
                                      fontSize: 13,
                                      color: "var(--s-color-text-subdued, #6D7175)",
                                      textDecoration: "none",
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.textDecoration = "underline")
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.textDecoration = "none")
                                    }
                                  >
                                    Skip for now
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <s-stack direction="inline" gap="small-200" alignItems="center">
                  {forceOnboarding && <s-badge tone="info">Dev preview</s-badge>}
                  <s-button
                    variant="tertiary"
                    onClick={() => {
                      if (forceOnboarding) {
                        navigate("/app");
                      } else {
                        navigate("/app?force=1");
                      }
                    }}
                  >
                    {forceOnboarding ? "Exit preview mode" : "Preview onboarding"}
                  </s-button>
                  <s-button
                    variant="tertiary"
                    tone="critical"
                    loading={fetcher.state !== "idle"}
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Reset onboarding? This disconnects Gmail, deactivates suppliers, and deletes reorder rules for this shop.",
                        )
                      )
                        return;
                      const fd = new FormData();
                      fd.append("intent", "reset-onboarding");
                      fetcher.submit(fd, { method: "post" });
                    }}
                  >
                    Reset onboarding (dev)
                  </s-button>
                </s-stack>
              </s-stack>
            </div>

            <img
              src={checklistSvg}
              alt=""
              style={{ width: 280, height: "auto", flexShrink: 0, alignSelf: "flex-end" }}
            />
          </div>
        </div>
      </s-section>
    </div>
  );
}

function StepIndicator({
  state,
}: {
  state: "done" | "current" | "upcoming";
}) {
  if (state === "done") {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#1A7A4C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="10" height="8" viewBox="0 0 12 10" fill="none">
          <path
            d="M1 5L4.5 8.5L11 1.5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (state === "current") {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: "2px solid #005BD3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: "white",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#005BD3",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: "2px solid var(--s-color-border, #E1E3E5)",
        flexShrink: 0,
        background: "white",
        boxSizing: "border-box",
      }}
    />
  );
}
