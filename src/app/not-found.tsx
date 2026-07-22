import Link from 'next/link';

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <div style={styles.container}>
          <h1 style={styles.title}>404</h1>
          <p style={styles.text}>Could not find requested resource</p>
          <Link href="/" style={styles.link}>
            Go back home
          </Link>
        </div>
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
    backgroundColor: '#fafafa',
  },
  title: {
    fontSize: '6rem',
    fontWeight: 700,
    color: '#111',
    marginBottom: '1rem',
    lineHeight: 1,
  },
  text: {
    fontSize: '1.25rem',
    color: '#666',
    marginBottom: '2rem',
    maxWidth: '400px',
  },
  link: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#111',
    borderRadius: '0.5rem',
    textDecoration: 'none',
    transition: 'background-color 0.2s',
  },
};
