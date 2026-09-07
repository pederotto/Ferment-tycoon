
import React from 'react';
import { SealGlyphIcon, ScienceIcon, LabLedgerIcon, MarketLedgerIcon, ArrowRightIcon } from './icons';

interface WelcomeScreenProps {
    onStart: () => void;
    onContinue?: () => void;
    save?: { savedAt: number; week: number; year: number; money: number } | null;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onContinue, save }) => {
    const hasSave = !!(save && onContinue);
    return (
        <div
            onClick={hasSave ? undefined : onStart}
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 select-none overflow-hidden ${hasSave ? '' : 'cursor-pointer'}`}
            style={{
                background: `
                    radial-gradient(ellipse 700px 500px at 15% 10%, rgba(217,164,65,0.09), transparent 60%),
                    radial-gradient(ellipse 700px 600px at 90% 95%, rgba(138,154,107,0.07), transparent 60%),
                    #120d09
                `,
            }}
        >
            <div className="grain" />

            {/* Ambient bubbles */}
            <div className="bubble" style={{ width: 120, height: 120, left: 40, top: 60 }} />
            <div className="bubble" style={{ width: 70, height: 70, left: 120, top: 180 }} />
            <div className="bubble" style={{ width: 160, height: 160, right: 40, bottom: 40, background: 'rgba(138,154,107,0.08)', borderColor: 'rgba(138,154,107,0.16)' }} />
            <div className="bubble" style={{ width: 60, height: 60, right: 140, top: 90, background: 'rgba(138,154,107,0.08)', borderColor: 'rgba(138,154,107,0.16)' }} />

            <div className="welcome-card">
                <div className="seal">
                    <SealGlyphIcon size={38} />
                </div>
                <div className="kicker">Atelier &amp; Culture House</div>
                <h1 className="title slab">FERMENTA <span className="accent">TYCOON</span></h1>
                <p className="tagline">
                    Master the craft of controlled rot. Tend koji, garums, and misos by hand —
                    heat, salt, and patience are your only real ingredients.
                </p>

                <div className="ledger-lines">
                    <div className="ledger-line">
                        <div className="ic"><ScienceIcon size={16} /></div>
                        <div>
                            <div className="t">The Science</div>
                            <div className="d">Real biology under the hood — temperature, humidity, and salt all matter.</div>
                        </div>
                    </div>
                    <div className="ledger-line">
                        <div className="ic"><LabLedgerIcon size={16} color="#8a9a6b" /></div>
                        <div>
                            <div className="t">The Lab</div>
                            <div className="d">Grow the bench, hire staff, and automate the parts you've mastered.</div>
                        </div>
                    </div>
                    <div className="ledger-line">
                        <div className="ic"><MarketLedgerIcon size={16} /></div>
                        <div>
                            <div className="t">The Market</div>
                            <div className="d">Sell clean to restaurants, or take the risk — and the price — of the underground.</div>
                        </div>
                    </div>
                </div>

                {hasSave ? (
                    <>
                        <button className="welcome-cta" onClick={onContinue} type="button">
                            CONTINUE THE CULTURE
                            <ArrowRightIcon size={16} />
                        </button>
                        <div className="save-line">
                            Year {save!.year} &middot; Week {save!.week} overall &middot; ${save!.money.toLocaleString()} on hand
                        </div>
                        <button className="welcome-alt" onClick={onStart} type="button">
                            Start over &mdash; this clears the saved run
                        </button>
                    </>
                ) : (
                    <button className="welcome-cta" onClick={onStart} type="button">
                        BEGIN THE CULTURE
                        <ArrowRightIcon size={16} />
                    </button>
                )}
                <div className="stamp-line">Est. Y1 &middot; Physics Engine Active</div>
            </div>
        </div>
    );
};

export default WelcomeScreen;
