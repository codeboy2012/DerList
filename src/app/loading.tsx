export default function Loading() {
  return (
    <html lang="en">
      <body>
        <div style={styles.container}>
          <div style={styles.spinner} aria-label="Loading" />
          <p style={styles.text}>Loading...</p>
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
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e5e5',
    borderTopColor: '#111',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '1rem',
  },
  text: {
    fontSize: '1rem',
    color: '#666',
  },
};
