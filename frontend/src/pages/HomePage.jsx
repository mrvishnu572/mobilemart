import { Link } from "react-router-dom";

export const HomePage = () => (
  <>
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow">A better way to choose</p>
        <h1>Find your next phone with clarity.</h1>
        <p>Compare genuine new phones by price, camera, battery, RAM, and storage—without the noise.</p>
        <Link className="button button-primary" to="/phones">Browse phones</Link>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="phone phone-back" />
        <div className="phone phone-front"><span>MobileMart</span><i /></div>
      </div>
    </section>

    <section className="content-section benefits">
      <div><strong>Clear specifications</strong><span>Everything important, side by side.</span></div>
      <div><strong>Verified stock</strong><span>Only phones currently available to order.</span></div>
      <div><strong>Simple checkout</strong><span>Secure test payment or cash on delivery.</span></div>
    </section>

    <section className="content-section callout">
      <div>
        <p className="eyebrow">Explore by need</p>
        <h2>Budget, flagship, camera, or gaming?</h2>
      </div>
      <Link className="button button-secondary" to="/phones">See the catalogue</Link>
    </section>
  </>
);

