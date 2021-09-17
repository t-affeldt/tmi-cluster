const { Cluster } = require('./Cluster.js');

const defaults = {
  connections: 10,
  mock_membership: false,
  membership_timer_local: 20000,
  membership_timer_global: 20
};

const cluster = tmi => new ClusterLibrary(tmi);

class ClusterLibrary {
  constructor(tmi) {
    if (!tmi) {
      throw new Error('Missing TMI.js instance');
    }
    this.tmi = tmi;
  }
  Client(config) {
    if (!config.identity && !config.authProvider) {
      throw new Error('Missing account credentials');
    }
    config = config ?? {};
    config.cluster = config.cluster ?? {};
    config.cluster = { ...defaults, ...config.cluster };
    config.options = config.options ?? {};
    return new Cluster(this.tmi, config);
  }
}

module.exports = cluster;
