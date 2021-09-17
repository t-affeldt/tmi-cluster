class Client {
  constructor(tmi, config) {
    if (config.cluster.mock_membership) {
      config.options.skipMembership = true;
    }
    this.client = tmi.Client({ ...config, cluster: undefined });
  }
  getChannels() {
    return this.client.getChannels();
  }
  execute(method, ...args) {
    return this.client[method](...args);
  }
}

class AuthenticatedClient extends Client {
  constructor(tmi, config) {
    config.options.skipUpdatingEmotesets = true;
    super(tmi, config);
  }
}

class UnauthenticatedClient extends Client {
  constructor(tmi, config) {
    config.identity = undefined;
    config.authProvider = undefined;
    super(tmi, config);
  }
}

module.exports = { AuthenticatedClient, UnauthenticatedClient };
