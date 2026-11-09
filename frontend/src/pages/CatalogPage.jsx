import { useEffect, useState } from "react";

import { api, getApiError } from "../api/client.js";
import { ProductCard } from "../components/ProductCard.jsx";

export const CatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [status, setStatus] = useState({ loading: true, error: "" });

  const loadProducts = async (event) => {
    event?.preventDefault();
    setStatus({ loading: true, error: "" });
    try {
      const response = await api.get("/products", { params: { search, sort } });
      setProducts(response.data.data.products);
    } catch (error) {
      setStatus({ loading: false, error: getApiError(error, "Unable to load phones. Start the backend and try again.") });
      return;
    }
    setStatus({ loading: false, error: "" });
  };

  useEffect(() => { loadProducts(); }, []);

  return (
    <section className="page content-section">
      <div className="page-heading">
        <div><p className="eyebrow">Phone catalogue</p><h1>Choose the phone that fits.</h1></div>
      </div>
      <form className="catalog-toolbar" onSubmit={loadProducts}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Samsung, camera, 5G..." />
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
        <button className="button button-primary">Search</button>
      </form>
      {status.loading ? <p className="state-message">Loading phones…</p> : null}
      {status.error ? <p className="state-message error-message">{status.error}</p> : null}
      {!status.loading && !status.error && products.length === 0 ? <p className="state-message">No phones are listed yet. An administrator can add the first products.</p> : null}
      <div className="product-grid">{products.map((product) => <ProductCard key={product._id} product={product} />)}</div>
    </section>
  );
};

