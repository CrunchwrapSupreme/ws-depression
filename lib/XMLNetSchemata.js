import XMLReader from './XMLReader.js';
import XMLSchema from './XMLSchema.js';
import XMLSchemata from './XMLSchemata.js';

import { lstatSync, readFileSync, createReadStream, createWriteStream, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import path, { join, dirname as _dirname } from 'path';
import { fileURLToPath } from 'url';
import redirect_client from 'follow-redirects';

const { namespaceURI } = XMLSchema;
const { adjustNode } = XMLSchema;
const get_http = redirect_client.http.get;
const get_https = redirect_client.https.get;

function toURL (fpath) {
  try {
    return new URL(fpath);
  } catch (e) {
    return false;
  }
}

class SchemaNetCache {
  constructor (fpath, forceCache = true) {
    const stat_opts = { throwIfNoEntry: false };
    this.root_path = fpath;
    this.index_path = join(fpath, 'schemas.idx');
    this.httpsOnly = process.env.NODE_ENV === 'production';
    this.forceCache = forceCache;

    if (!lstatSync(fpath, stat_opts)?.isDirectory()) {
      throw new Error(`${fpath} must be a directory!`);
    }

    const index_lstat = lstatSync(this.index_path, stat_opts);
    if (index_lstat?.isFile()) {
      const _buf = readFileSync(this.index_path, { encoding: 'utf-8' });
      const mappings = Object.entries(JSON.parse(_buf));
      this.index = new Map(mappings);
    } else {
      if (index_lstat) {
        throw new Error('Delete that nonsense bruh.');
      }
      this.index = new Map();
    }
  }

  // Get a stream according to the schemaLocation from either cache or interwebs
  async resolve_stream (location) {
    if (this.index.has(location)) {
      const loc_name = this.index.get(location);
      const loc_path = join(this.root_path, loc_name);
      return Promise.resolve(createReadStream(loc_path));
    } else if (this.forceCache) {
      return Promise.reject(new Error("Uh oh! Don't do a naughty in prod!"));
    } else {
      return this.updateNStream(location);
    }
  }

  // Commit a new definition to the local cache and stream from it
  async updateNStream (location) {
    const stream = await this.net_stream(location);
    const hsh = createHash('md5').update(location).digest('hex');
    const cache_name = `${hsh}.xsd`;
    const cache_path = join(this.root_path, cache_name);
    const index_path = this.index_path;
    this.index.set(location, cache_name);
    const index = Object.fromEntries(this.index);

    const fw_stream = createWriteStream(cache_path);
    stream.pipe(fw_stream);

    return new Promise((resolve, reject) => {
      fw_stream.on('finish', () => {
        writeFileSync(index_path, JSON.stringify(index));
        resolve(createReadStream(cache_path));
      });
      fw_stream.on('error', reject);
    });
  }

  // Return http or https file stream
  async net_stream (location) {
    return new Promise((resolve, reject) => {
      let req;
      const load_url = toURL(location);
      switch (load_url.protocol) {
        case 'https:':
          req = get_https(load_url, resolve);
          break;
        case 'http:':
          if (this.httpsOnly) {
            reject(new Error(`May not load http definition files (${location}) in production!`));
            return;
          }
          req = get_http(load_url, resolve);
          break;
        default:
          reject(new Error(`Unknown protocol ${load_url.protocol} for schema location.`));
          return;
      }
      req.on('error', reject);
    });
  }
}

class XMLNetSchemata extends XMLSchemata {
  constructor(forceCache = true) {
    super();
    const surl = new URL('../.schema_cache', import.meta.url);
    const spath = fileURLToPath(surl);
    this.schema_cache = new SchemaNetCache(spath, forceCache);
  }

  // Factory method for generating schemata for .wsdl or .xds file (local or network)
  static async fromNetFiles (...files) {
    const schemata = new this();
    for (const file of files) {
      await schemata.addNetFile(file);
    }
    return schemata;
  }

  // Stream baby... STREAM!
  async agnosticFileStream (fn) {
    return new Promise((resolve, reject) => {
      if (toURL(fn)) {
        resolve(this.schema_cache.resolve_stream(fn));
      } else {
        const dirname = _dirname(fn);
        const load_path = join(dirname, fn);
        resolve(createReadStream(load_path));
      }
    });
  }

  // Enumerate schema definitions
  async addNetFile (fn, options = {}) {
    const that = this;
    const addLocation = async function (schemaLocation, namespace) {
      await that.addNetFile(schemaLocation, options = { targetNamespace: namespace });
    };

    const { targetNamespace } = options;
    const mapper = n => n.detach();
    const reader = new XMLReader({
      filterElements: e => e.namespaceURI === namespaceURI,
      map: adjustNode
    });

    const stream = await this.agnosticFileStream(fn);

    for await (const node of reader.process(stream)) {
      if (node.localName === 'schema') {
        await this.addSchema(mapper(node), { addLocation, targetNamespace });
      }
    }
  }
}

export default XMLNetSchemata;
