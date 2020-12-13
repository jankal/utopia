# Utopia Deployment Server - 🚧 Under Construction 🚧

Utopia deploys your static files to random subdomains or even to the domain itself with `mode=live`.

## Set up

1. Clone this repository
2. Install dependencies

  ```bash
  npm install
  ```

3. Build TS code to JS code for Node.js to run it

  ```bash
  npm run build
  ```

4. Start the server

  ```bash
  DOMAIN=whatever.com npm run start
  ```

## Requirements

For everything to work correctly, your domain (e.g. `whatever.com`) has to have the folowing DNS set up:

```bind
*.whatever.com. IN A <server-ip>
whatever.com. IN A <server-ip>
```

Your servers ports `80 / http` and `443 / https` must not be filtered by any firewall.
