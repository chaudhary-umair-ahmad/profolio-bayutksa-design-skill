/**
 * Local stand-in for the private @sector-labs/fe-auth-redux.
 *
 * The real package is on a Nexus mirror this sandbox cannot reach. It is
 * imported once, in src/keycloak/index.js, for one class — and that class is
 * only constructed in the branch `isDevelopment` does not take:
 *
 *   const keycloak = isDevelopment
 *     ? (await import('keycloak-js')).default
 *     : new KeycloakStratAuthenticator(...)
 *
 * The harness runs with REACT_APP_ENVIRONMENT=development, so this class is
 * never instantiated. It exists to satisfy the module graph, nothing more. If
 * something ever does construct it, it throws rather than pretending to work —
 * a silent no-op authenticator would be a much worse bug than a crash.
 */
export class KeycloakStratAuthenticator {
  constructor() {
    throw new Error(
      '@sector-labs/fe-auth-redux is stubbed in the capture harness. ' +
      'Reaching this means REACT_APP_ENVIRONMENT is not "development".'
    );
  }
}

export default { KeycloakStratAuthenticator };
