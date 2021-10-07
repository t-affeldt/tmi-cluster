const clone = require('deep-clone');
const { AuthenticatedClient, UnauthenticatedClient } = require('./Client.js');
const { chunks } = require('./utils.js');
const { Chatwatch } = require('./Chatwatch.js');

// public methods will be executed against the respective unauthorized connection
// shared methods will be executed against all connections
// any other methods will be executed against the main authorized connection



class Cluster {
  constructor(tmi, config) {
    this.config = config;
    this.joinQueue = [];
    this.eventHandles = {};

    this.main = new AuthenticatedClient(tmi, {...clone(config), channels: [] });
    this.clients = [];

    let channels = config.channels ?? [];
    channels = channels.map(channel => this.#parseChannelName(channel));

    if (config.cluster.mock_membership) {
      // start watching chatter changes
      this.chatwatch = new Chatwatch(
        channels,
        clone(config),
        this.main.execute('getUsername'),
        (event, ...args) => {
          const handles = this.eventHandles[event] ?? [];
          handles.forEach(handle => handle(...args));
        }
      );
    }

    // create anonymous connections
    const chunkSize = Math.ceil(channels.length / config.cluster.connections);
    const channelChunks = chunks(channels, chunkSize);
    for (let i = 0; i < config.cluster.connections; i++) {
      const currentChannels = channelChunks.next().value ?? [];
      const client = new UnauthenticatedClient(tmi, {
        ...clone(config),
        channels: currentChannels
      });
      this.clients.push(client);
    }

    // start handling .join() calls once all channels from initialization are joined
    const joinDuration = channels.length * (config.options?.joinInterval ?? 2000);
    const clusterJoinDuration = Math.ceil(joinDuration / config.cluster.connections);
    setTimeout(() => this.#handleJoins(), clusterJoinDuration);

    // wrap TMI.js methods
    this.publicMethods = [ 'isMod' ];
    this.sharedMethods = [ ];

    for (const method in tmi.Client.prototype) {
      const predefinedMethods = [
        ...this.publicMethods,
        ...this.sharedMethods
      ];
      if (typeof tmi.Client.prototype[method] !== 'function') { continue; }
      if (typeof this[method] !== 'undefined') { continue; }
      if (method.startsWith('_')) { continue; }
      if (predefinedMethods.includes(method)) { continue; }
      if (!tmi.Client.prototype.hasOwnProperty(method)) {
        // method from EventEmitter, run against all connections
        this.sharedMethods.push(method);
      }
      this[method] = (...args) => {
        return this.#proxyMethod(method, args);
      }
    }
  }

  connect() {
    if (this.config.cluster.mock_membership) {
      this.chatwatch.connect();
    }
    return this.#proxyAll('connect');
  }

  disconnect() {
    if (this.config.cluster.mock_membership) {
      this.chatwatch.disconnect();
    }
    return this.#proxyAll('disconnect');
  }

  pingAll() {
    return this.#proxyAll('ping',);
  }

  readyStateAll() {
    return this.#proxyAll('readyState');
  }

  join(channel) {
    channel = this.#parseChannelName(channel);
    this.joinQueue.push(channel);
  }

  part(channel) {
    channel = this.#parseChannelName(channel);
    const clientId = this.#findClient(channel);
    if (clientId !== -1) {
      this.clients[clientId].execute('part', channel);
    }
  }

  getChannels() {
    return [this.main, ...this.clients]
      .map(client => client.getChannels())
      .reduce((prev, curr) => [...prev, ...curr], []);
  }

  chatters(channel) {
    if (!this.config.cluster.mock_membership) {
      throw new Error('Chatters List is only available when mock_membership is used');
    }
    channel = this.#parseChannelName(channel);
    const listId = this.chatwatch.channels.indexOf(channel);
    if (listId === -1) { return null; }
    return this.chatwatch.chatters[listId];
  }

  #parseChannelName(channel) {
    if (typeof channel !== 'string') {
      return null;
    }
    channel = channel.toLowerCase();
    channel = channel.startsWith('#') ? channel: '#' + channel;
    return channel;
  }

  #findClient(channel) {
    if (typeof channel !== 'string') {
      return -1;
    }
    channel = this.#parseChannelName(channel);
    for (let i = 0; i < this.config.cluster.connections; i++) {
      const clientChannels = this.clients[i].getChannels();
      if (clientChannels.includes(channel)) {
        return i;
      }
    }
    return -1;
  }

  #proxyMethod(method, args) {
    args = args ?? [];
    if (this.sharedMethods.includes(method)) {
      if (
        this.config.cluster.mock_membership
        && ['join', 'part'].includes(args[0])
      ) {
        return this.chatwatch[method](...args);
      } else {
        return this.#proxyAll(method, args)
      }
    } else if (this.publicMethods.includes(method)) {
      // find anonymous client and execute there
      const channel = channel = this.#parseChannelName(args[0]);
      const clientId = this.#findClient(channel);
      if (clientId !== -1) {
        return this.clients[clientId].execute(method, ...args);
      } else {
        // fallback to main client
        return this.main.execute(method, ...args);
      }
    } else {
      // execute with authenticated client
      return this.main.execute(method, ...args);
    }
  }

  #proxyAll(method, args) {
    args = args ?? [];
    return Promise.all(
      [this.main, ...this.clients]
      .map(client => client.execute(method, ...args))
    );
  }

  #handleJoins() {
    const sort = (a, b) => a.channelCount > b.channelCount ? 1 : a.channelCount < b.channelCount ? -1 : 0;
    if (this.joinQueue.length > 0) {
      this.clients.map(client => {
        return {
          client: client,
          channelCount: client.getChannels().length
        }
      }).sort(sort);
      const joins = this.joinQueue.splice(0, this.config.cluster.connections);
      for (let i = 0, l = joins.length; i < l; i++) {
        const channel = joins[i];
        this.clients[i].execute('join', channel);
      }
    }
    const joinInterval = this.config.options?.joinInterval ?? 2000;
    setTimeout(() => this.#handleJoins(), joinInterval);
  }
}

module.exports = { Cluster };
