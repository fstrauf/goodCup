// Add custom HTML to your web app
export default function Root({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>goodCup Coffee Tracker</title>
      </head>
      <body>{children}</body>
    </html>
  );
} 