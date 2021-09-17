# tmi-cluster

## Features
- Provides an API endpoint almost identical to tmi.js
- Manages a cluster of anonymous Twitch IRC connections for unlimited read access
- Utilizes authorized bot account for write access
- Mocks join and part events using more reliable tmi.twitch.tv endpoint

## Usage
### Minimal Example
```js
import tmi from 'tmi.js';
import cluster from 'tmi-cluster';

const client = cluster(tmi).Client({
  identity: {
    username: 'botname',
    password: 'oauth:abcdefxyz..'
  },
  channels: [ '#example_user' ]
});

await client.connect();

client.say('#example_user', 'hello :)');
```

### Cluster Configuration
```js
const client = cluster(tmi).Client({
  identity: {
    username: 'botname',
    password: 'oauth:abcdefxyz..'
  },
  cluster: {
    // how many anonymous connections to keep open
    connections: 10,

    // whether ot not IRC join / part messages shall be
    // replaced by more reliable tmi.twitch.tv endpoint
    mock_membership: true,

    // only applies if mock_membership is true
    // determines how many seconds it should wait before fetching
    // the same list of chatters
    membership_timer_local: 20000,

    // only applies if mock_membership is true
    // determines how many seconds it should wait between fetching
    // different lists of chatters
    membership_timer_global: 20
  }
});
```

## Noticeable Differences to tmi.js
* Has to be initialized with login credentials. Purely anonymous connections are not possible. Authentication via @twurple/auth-tmi also works if respective API is provided instead of tmi.js
* ``client.ping()`` will return reply from authenticated connection.
* Additional ``client.pingAll()`` method that pings every connection. Reply from authenticated connection is the first entry.
* ``client.readyState()`` will return reply from authenticated connection.
* Additional ``client.readyStateAll()`` method that returns array of all ready states. Reply from authenticated connection is the first entry.
* [Only when using mock_membership = true] Additional ``client.chatters(channel)`` method that returns cached list of viewers connected to chat. This is the exact reply from tmi.twitch.tv
* [Only when using mock_membership = true] ``client.on('join', callback)`` provides an additional callback parameter, indicating the user group of the joined chatter (broadcaster, vips, moderators, staff, admins, global_mods, viewers)
