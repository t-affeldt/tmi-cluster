const axios = require('axios');
const { EventEmitter } = require('./EventEmitter.js');
const { findDifferences } = require('./utils.js');

const api = 'https://tmi.twitch.tv/group/user/$user/chatters';

class Chatwatch extends EventEmitter {

  constructor(channels, config, self) {
    super();
    this.setMaxListeners(0);

    this.config = config;
    this.self = self,
    this.channels = channels ?? [];
    this.chatters = [];
    this.iterator = 0;
    this.local_waittime = config.cluster.membership_timer_local;
    this.global_waittime = config.cluster.membership_timer_global;
    this.timeout = null;
  }

  join(channel) {
    if (!channels.includes(channel)) {
      this.channels.push(channel);
    }
  }

  part(channel) {
    const index = this.channels.indexOf(channel);
    if (index !== -1) {
      this.channels.splice(index, 1);
      this.chatters.splice(index, 1);
      if (this.iterator >= this.channels.length - 1) {
        this.iterator = 0;
      } else if (this.iterator > index) {
        this.iterator++;
      }
    }
  }

  async updateChannel() {
    if (this.channels.length < 1) { return; }
    let channel = this.channels[this.iterator];
    let data;
    try {
      data = (await axios.get(api.replace('$user', channel.slice(1)), {
        headers: { 'Accept': 'application/json' }
      })).data;
    } catch(e) {
      console.warn('Failed to fetch watchers', e);
      return;
    }
    if (this.channels[this.iterator] !== channel) {
      // channel parted while being fetched
      return;
    }
    const prevData = this.chatters[this.iterator];
    if (prevData) {
      for (const type in data.chatters) {
        const prev = prevData.chatters[type] ?? [];
        const current = data.chatters[type] ?? [];
        const diff = findDifferences(prev, current);
        for (const username of diff[0]) {
          const self = username === this.self;
          this.emit('part', channel, username, self, type);
        }
        for (const username of diff[1]) {
          const self = username === this.self;
          this.emit('join', channel, username, self, type);
        }
      }
    }
    this.chatters[this.iterator] = data;
    this.iterator++;
    if (this.iterator > this.channels.length - 1) {
      this.iterator = 0;
    }
  }

  async update() {
    await this.updateChannel();
    let waittime;
    if (this.channels.length < 1) {
      waittime = this.global_waittime;
    } else {
      waittime = Math.max(
        this.global_waittime,
        Math.ceil(this.local_waittime / this.channels.length)
      );
    }
    this.timeout = setTimeout(() => { this.update(); }, waittime);
  }

  connect() {
    if (!this.timeout) {
      this.update();
    }
  }

  disconnect() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

}

module.exports = { Chatwatch };
