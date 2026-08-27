import { RouterProvider, createHashRouter } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CipherPage from './pages/CipherPage';
import Analyse from './pages/Analyse';
import Timeline from './pages/Timeline';
import Compare from './pages/Compare';
import Playground from './pages/Playground';
import NotFound from './pages/NotFound';

/**
 * A hash router, not a browser router.
 *
 * GitHub Pages serves static files with no rewrite rule, so a browser router
 * would 404 on a refresh at /cipher/caesar. Everything after the # never reaches
 * the server, which is exactly what a static host needs.
 */
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'cipher/:slug', element: <CipherPage /> },
      { path: 'timeline', element: <Timeline /> },
      { path: 'compare', element: <Compare /> },
      { path: 'playground', element: <Playground /> },
      { path: 'analyse', element: <Analyse /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
