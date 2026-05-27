// Google Fonts for Onshape — warm landing variant (orange → red).
// Ported from /design/landing-page.jsx with theme="warm" baked in.

import Image from "next/image";
import { SiteShell } from "@/components/SiteShell";

const C1 = "#F48635"; // orange
const C2 = "#ed3338"; // red
const C1_RGB = "244, 134, 53";
const GRADIENT = `linear-gradient(135deg, ${C1} 0%, ${C2} 100%)`;

const css = `
.lp{--c1:${C1};--c2:${C2};--c1-rgb:${C1_RGB};--grad:${GRADIENT};
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1a1d23;background:#fff;
  width:100%;font-size:15px;line-height:1.55;overflow-x:hidden}
.lp *{box-sizing:border-box}

.lp-nav{display:flex;align-items:center;justify-content:space-between;
  padding:18px 56px;border-bottom:1px solid #eceff3;background:#fff;
  position:sticky;top:0;z-index:5}
.lp-brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;
  letter-spacing:-.005em;color:#1a1d23}
.lp-brand-mark{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;
  justify-content:center;background:var(--grad);border:1px solid transparent;padding:5px}
.lp-brand-mark svg{width:100%;height:100%;display:block;fill:#fff}
.lp-nav-r{display:flex;gap:28px;align-items:center;font-size:13.5px;color:#4a5260}
.lp-nav-r a{color:inherit;text-decoration:none}
.lp-nav-r a:hover{color:#1a1d23}
.lp-nav-r a.lp-cta-sm,.lp-cta-sm{padding:7px 14px;background:var(--grad);color:#fff;
  border-radius:5px;font-weight:500;font-size:13px;border:1px solid transparent;
  cursor:pointer;text-decoration:none;display:inline-block}
.lp-nav-r a.lp-cta-sm:hover,.lp-cta-sm:hover{filter:brightness(1.04);color:#fff}

.lp-hero{padding:96px 56px 72px;display:grid;grid-template-columns:1.05fr .95fr;
  gap:64px;align-items:center;max-width:1280px;margin:0 auto}
@media (max-width:960px){.lp-hero{grid-template-columns:1fr;padding:64px 28px 48px}
  .lp-nav{padding:16px 28px}.lp-section{padding:64px 28px}.lp-foot{padding:28px}}
.lp-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:5px 11px 5px 8px;
  background:#eef4fc;color:#0a4a85;border-radius:999px;font-size:12px;font-weight:500;
  letter-spacing:.01em;margin-bottom:22px}
.lp-eyebrow-dot{width:5px;height:5px;border-radius:50%;background:var(--c1)}
.lp-h1{font-size:54px;line-height:1.05;letter-spacing:-.025em;font-weight:600;
  margin:0 0 22px;color:#0f1216;text-wrap:balance}
@media (max-width:600px){.lp-h1{font-size:40px}}
.lp-h1 em{font-style:italic;font-family:"Playfair Display","Times New Roman",serif;
  font-weight:500;background:var(--grad);-webkit-background-clip:text;
  background-clip:text;color:transparent}
.lp-lead{font-size:18px;line-height:1.55;color:#4a5260;margin:0 0 32px;max-width:520px}
.lp-ctas{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.lp-cta{padding:13px 22px;font-size:14.5px;font-weight:500;border-radius:6px;
  cursor:pointer;border:1px solid var(--c1);background:var(--c1);color:#fff;
  display:inline-flex;align-items:center;gap:9px;letter-spacing:.005em;
  transition:filter .12s,box-shadow .12s;text-decoration:none}
.lp-cta:hover{filter:brightness(.96);box-shadow:0 6px 18px rgba(var(--c1-rgb),.30)}
.lp-cta.alt{background:transparent;color:var(--c1);border-color:var(--c1)}
.lp-cta.alt:hover{background:rgba(var(--c1-rgb),.08);box-shadow:none;filter:none}
.lp-cta svg{width:15px;height:15px}
.lp-trust{display:flex;align-items:center;gap:18px;margin-top:26px;
  font-size:12.5px;color:#6b7280;flex-wrap:wrap}
.lp-trust .check{display:inline-flex;align-items:center;gap:6px}
.lp-trust .check svg{width:13px;height:13px;color:#22a06b}

.lp-hero-vis{position:relative;border:1px solid #e3e7ec;
  border-radius:10px;overflow:hidden;
  box-shadow:0 24px 60px -20px rgba(15,30,60,.18),0 2px 6px rgba(15,30,60,.05)}

.lp-section{padding:80px 56px;max-width:1280px;margin:0 auto}
.lp-section-h{display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:14px;margin-bottom:56px}
.lp-section-eyebrow{font-size:12px;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--c1)}
.lp-section-h h2{font-size:38px;line-height:1.1;letter-spacing:-.02em;font-weight:600;
  margin:0;color:#0f1216;max-width:680px;text-wrap:balance}
.lp-section-h p{font-size:17px;color:#4a5260;margin:0;max-width:560px;line-height:1.55}

.lp-demo-wrap{background:linear-gradient(180deg,#f5f7fa 0%,#eef1f5 100%);
  padding:80px 56px;border-top:1px solid #eceff3;border-bottom:1px solid #eceff3}
.lp-demo{max-width:1080px;margin:0 auto;background:#0f1216;border-radius:12px;
  aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;
  position:relative;overflow:hidden;
  box-shadow:0 30px 80px -30px rgba(15,30,60,.45),0 4px 14px rgba(15,30,60,.1);
  background-image:
    repeating-linear-gradient(45deg,rgba(255,255,255,.02) 0 14px,transparent 14px 28px)}
.lp-demo::before{content:"";position:absolute;inset:0;
  background:radial-gradient(circle at 50% 40%,rgba(var(--c1-rgb),.20) 0%,transparent 55%)}
.lp-demo-play{width:74px;height:74px;border-radius:50%;background:#fff;
  display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;z-index:1;
  box-shadow:0 8px 30px rgba(0,0,0,.3)}
.lp-demo-play svg{width:24px;height:24px;color:#0f1216;margin-left:3px}
.lp-demo-label{position:absolute;bottom:22px;left:24px;color:rgba(255,255,255,.55);
  font-family:"SFMono-Regular",Menlo,monospace;font-size:11px;letter-spacing:.08em;z-index:1}

.lp-shots{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
@media (max-width:760px){.lp-shots{grid-template-columns:1fr}}
.lp-shot{aspect-ratio:4/3;border:1px solid #e3e7ec;border-radius:8px;background:#f5f7fa;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  background-image:
    repeating-linear-gradient(-45deg,transparent 0 10px,rgba(15,30,60,.04) 10px 11px);
  color:#94a0b0;font-family:"SFMono-Regular",Menlo,monospace;font-size:11.5px;
  letter-spacing:.04em;text-align:center;padding:20px;position:relative;overflow:hidden}
.lp-shot::before{content:"";position:absolute;top:0;left:0;right:0;height:24px;
  background:#fff;border-bottom:1px solid #e3e7ec;
  background-image:radial-gradient(circle at 10px 12px,#ff5f57 4px,transparent 5px),
                   radial-gradient(circle at 24px 12px,#febc2e 4px,transparent 5px),
                   radial-gradient(circle at 38px 12px,#28c840 4px,transparent 5px)}
.lp-shot-cap{font-weight:500;color:#4a5260;font-family:inherit;font-size:13px;letter-spacing:0;
  margin-top:auto;background:#fff;padding:5px 10px;border-radius:4px;border:1px solid #e3e7ec}

.lp-price-wrap{background:#fffaf6;border-top:1px solid #eceff3}
.lp-price{display:flex;justify-content:center}
.lp-card{background:#fff;border:1px solid #e3e7ec;border-radius:12px;padding:36px 40px;
  width:420px;max-width:100%;text-align:left;position:relative;
  box-shadow:0 1px 0 rgba(15,30,60,.02),0 8px 24px -12px rgba(15,30,60,.10)}
.lp-card-tag{position:absolute;top:18px;right:18px;background:rgba(var(--c1-rgb),.14);
  color:#a83611;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;
  letter-spacing:.04em;text-transform:uppercase}
.lp-card-h{font-size:14px;font-weight:600;color:#4a5260;letter-spacing:.02em;margin:0 0 8px}
.lp-price-big{font-size:56px;font-weight:600;letter-spacing:-.03em;color:#0f1216;line-height:1;
  display:flex;align-items:baseline;gap:6px;margin-bottom:6px}
.lp-price-big .sub{font-size:15px;font-weight:500;color:#6b7280;letter-spacing:0}
.lp-card-sub{color:#6b7280;font-size:13.5px;margin:0 0 24px}
.lp-card ul{list-style:none;padding:0;margin:0 0 28px;display:flex;flex-direction:column;gap:11px}
.lp-card li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:#1a1d23;line-height:1.5}
.lp-card li svg{width:16px;height:16px;color:#22a06b;flex:0 0 auto;margin-top:2px}
.lp-card .lp-cta{width:100%;justify-content:center}

.lp-foot{padding:36px 56px;border-top:1px solid #eceff3;display:flex;
  justify-content:space-between;align-items:center;color:#6b7280;font-size:12.5px;flex-wrap:wrap;gap:12px}
.lp-foot a{color:inherit;text-decoration:none;margin-left:20px}
.lp-foot a:hover{color:#1a1d23}
`;

export default function Home() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500&display=swap"
        rel="stylesheet"
      />
      <SiteShell>
      <div className="lp">
        <style dangerouslySetInnerHTML={{ __html: css }} />

        <header className="lp-hero">
          <div>
            <div className="lp-eyebrow">
              <span className="lp-eyebrow-dot" />
              Free Onshape add-in · 1,900+ fonts
            </div>
            <h1 className="lp-h1">
              Type that turns
              <br />
              into <em>real geometry.</em>
            </h1>
            <p className="lp-lead">
              Bring all 1,900+ Google Fonts — or any .ttf / .otf you upload
              — straight into your Part Studio. Pick a face, type your text,
              click Insert. The result lands on the active sketch plane as
              native curves you can resize, rotate, and reposition anytime
              from the standard feature dialog.
            </p>
            <div className="lp-ctas">
              <a
                className="lp-cta"
                href="https://cad.onshape.com/appstore/apps/Utilities/6a0f2d2039092b5cfc0f712a"
                target="_blank"
                rel="noreferrer"
              >
                <svg viewBox="0 0 16 16">
                  <path
                    d="M3 8h10M8 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Add to Onshape — Free
              </a>
              <a className="lp-cta alt" href="/preview">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <polygon points="5,3.5 12,8 5,12.5" />
                </svg>
                Preview
              </a>
            </div>
            <div className="lp-trust">
              <span className="check">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Free forever
              </span>
              <span className="check">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Native sketch geometry
              </span>
              <span className="check">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="3,8 7,12 13,4" />
                </svg>
                Over 1,900 fonts
              </span>
            </div>
          </div>

          <div className="lp-hero-vis">
            <Image
              src="/screenshots/panel.png"
              alt="Google Fonts panel in Onshape — font picker with live sketch preview"
              width={1480}
              height={2368}
              priority
              sizes="(max-width: 960px) 100vw, 45vw"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                borderRadius: 8,
              }}
            />
          </div>
        </header>

        <section className="lp-demo-wrap" id="demo">
          <div className="lp-section-h" style={{ marginBottom: 40 }}>
            <div className="lp-section-eyebrow">See it in action</div>
            <h2>From font picker to extruded part in under a minute.</h2>
          </div>
          <div className="lp-demo">
            <div className="lp-demo-play">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 6,20 20,12" />
              </svg>
            </div>
            <div className="lp-demo-label">DEMO.MP4 · 1:24</div>
          </div>
        </section>

        <section className="lp-section" id="features">
          <div className="lp-section-h">
            <div className="lp-section-eyebrow">In context</div>
            <h2>One sketch tool — every font, native geometry.</h2>
            <p>
              The add-in lives as a panel inside Onshape, alongside the
              standard sketch tools. Skip the export-and-import detour to a
              vector editor: pick a font, type your text, click Insert. The
              result lands as native sketch curves. Em-height, rotation,
              origin point and offsets stay as live feature parameters so
              you can resize, rotate, and reposition anytime — to change
              the text, font, or layout, just open the panel again.
            </p>
          </div>
          <div className="lp-shots">
            <div className="lp-shot">
              <span>screenshot · part studio with panel open</span>
              <div className="lp-shot-cap">Side panel</div>
            </div>
            <div className="lp-shot">
              <span>screenshot · text inserted into sketch</span>
              <div className="lp-shot-cap">Native curves</div>
            </div>
            <div className="lp-shot">
              <span>screenshot · extruded text on part</span>
              <div className="lp-shot-cap">Extrude / emboss</div>
            </div>
          </div>
        </section>

        <section className="lp-price-wrap" id="pricing">
          <div className="lp-section" style={{ paddingTop: 80, paddingBottom: 80 }}>
            <div className="lp-section-h">
              <div className="lp-section-eyebrow">Pricing</div>
              <h2>Free. Forever.</h2>
              <p>
                No accounts, no upgrade prompts, no usage caps. Built as a
                weekend tool that grew up.
              </p>
            </div>
            <div className="lp-price">
              <div className="lp-card">
                <div className="lp-card-tag">Free</div>
                <div className="lp-card-h">Google Fonts for Onshape</div>
                <div className="lp-price-big">
                  <span style={{ marginRight: "0.08em" }}>$</span>0
                  <span className="sub">/ forever</span>
                </div>
                <p className="lp-card-sub">
                  Install in two clicks from the Onshape App Store.
                </p>
                <ul>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <polyline points="3,8 7,12 13,4" />
                    </svg>
                    All 1,900+ Google Fonts
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <polyline points="3,8 7,12 13,4" />
                    </svg>
                    Native sketch geometry
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <polyline points="3,8 7,12 13,4" />
                    </svg>
                    Resize, rotate, reposition from the feature dialog
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <polyline points="3,8 7,12 13,4" />
                    </svg>
                    Upload your own .ttf / .otf
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <polyline points="3,8 7,12 13,4" />
                    </svg>
                    10 language subsets, all weights &amp; styles
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <polyline points="3,8 7,12 13,4" />
                    </svg>
                    Works with team &amp; enterprise plans
                  </li>
                </ul>
                <a
                  className="lp-cta"
                  href="https://cad.onshape.com/appstore/apps/Utilities/6a0f2d2039092b5cfc0f712a"
                  target="_blank"
                  rel="noreferrer"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8h10M8 3l5 5-5 5" />
                  </svg>
                  Add to Onshape
                </a>
                <p style={{ marginTop: 16, fontSize: 13, color: "#6b7280", textAlign: "center" }}>
                  Saved you a few hours?{" "}
                  <a
                    href="https://donate.stripe.com/8x2dRafZtcY6fJI6Mj57W01"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#ed3338", textDecoration: "underline" }}
                  >
                    Buy me a coffee →
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>
      </SiteShell>
    </>
  );
}
