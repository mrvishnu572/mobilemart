import { Link } from "react-router-dom";

export const NotFoundPage = () => <section className="page content-section empty-state"><h1>That page does not exist.</h1><Link className="button button-primary" to="/">Back home</Link></section>;

