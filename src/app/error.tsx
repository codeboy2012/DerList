'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Something went wrong!</h1>

      <p style={styles.text}>{error.digest ? `Error ID: ${error.digest}` : error.message}</p>

      <button style={styles.button} onClick={() => reset()}>
        Try again
      </button>
    </div>
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
    fontSize: '2rem',
    fontWeight: 600,
    color: '#111',
    marginBottom: '1rem',
  },
  text: {
    fontSize: '1rem',
    color: '#666',
    marginBottom: '2rem',
    maxWidth: '400px',
  },
  button: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#111',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
