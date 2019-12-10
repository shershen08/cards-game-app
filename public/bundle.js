
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (!store || typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, callback) {
        const unsub = store.subscribe(callback);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        return definition[2] && fn
            ? $$scope.dirty | definition[2](fn(dirty))
            : $$scope.dirty;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            $$.fragment && $$.fragment.p($$.ctx, $$.dirty);
            $$.dirty = [-1];
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe,
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => store.subscribe((value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    const LOCATION = {};
    const ROUTER = {};

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    function getLocation(source) {
      return {
        ...source.location,
        state: source.history.state,
        key: (source.history.state && source.history.state.key) || "initial"
      };
    }

    function createHistory(source, options) {
      const listeners = [];
      let location = getLocation(source);

      return {
        get location() {
          return location;
        },

        listen(listener) {
          listeners.push(listener);

          const popstateListener = () => {
            location = getLocation(source);
            listener({ location, action: "POP" });
          };

          source.addEventListener("popstate", popstateListener);

          return () => {
            source.removeEventListener("popstate", popstateListener);

            const index = listeners.indexOf(listener);
            listeners.splice(index, 1);
          };
        },

        navigate(to, { state, replace = false } = {}) {
          state = { ...state, key: Date.now() + "" };
          // try...catch iOS Safari limits to 100 pushState calls
          try {
            if (replace) {
              source.history.replaceState(state, null, to);
            } else {
              source.history.pushState(state, null, to);
            }
          } catch (e) {
            source.location[replace ? "replace" : "assign"](to);
          }

          location = getLocation(source);
          listeners.forEach(listener => listener({ location, action: "PUSH" }));
        }
      };
    }

    // Stores history entries in memory for testing or other platforms like Native
    function createMemorySource(initialPathname = "/") {
      let index = 0;
      const stack = [{ pathname: initialPathname, search: "" }];
      const states = [];

      return {
        get location() {
          return stack[index];
        },
        addEventListener(name, fn) {},
        removeEventListener(name, fn) {},
        history: {
          get entries() {
            return stack;
          },
          get index() {
            return index;
          },
          get state() {
            return states[index];
          },
          pushState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            index++;
            stack.push({ pathname, search });
            states.push(state);
          },
          replaceState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            stack[index] = { pathname, search };
            states[index] = state;
          }
        }
      };
    }

    // Global history uses window.history as the source if available,
    // otherwise a memory history
    const canUseDOM = Boolean(
      typeof window !== "undefined" &&
        window.document &&
        window.document.createElement
    );
    const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
    const { navigate } = globalHistory;

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    const paramRe = /^:(.+)/;

    const SEGMENT_POINTS = 4;
    const STATIC_POINTS = 3;
    const DYNAMIC_POINTS = 2;
    const SPLAT_PENALTY = 1;
    const ROOT_POINTS = 1;

    /**
     * Check if `string` starts with `search`
     * @param {string} string
     * @param {string} search
     * @return {boolean}
     */
    function startsWith(string, search) {
      return string.substr(0, search.length) === search;
    }

    /**
     * Check if `segment` is a root segment
     * @param {string} segment
     * @return {boolean}
     */
    function isRootSegment(segment) {
      return segment === "";
    }

    /**
     * Check if `segment` is a dynamic segment
     * @param {string} segment
     * @return {boolean}
     */
    function isDynamic(segment) {
      return paramRe.test(segment);
    }

    /**
     * Check if `segment` is a splat
     * @param {string} segment
     * @return {boolean}
     */
    function isSplat(segment) {
      return segment[0] === "*";
    }

    /**
     * Split up the URI into segments delimited by `/`
     * @param {string} uri
     * @return {string[]}
     */
    function segmentize(uri) {
      return (
        uri
          // Strip starting/ending `/`
          .replace(/(^\/+|\/+$)/g, "")
          .split("/")
      );
    }

    /**
     * Strip `str` of potential start and end `/`
     * @param {string} str
     * @return {string}
     */
    function stripSlashes(str) {
      return str.replace(/(^\/+|\/+$)/g, "");
    }

    /**
     * Score a route depending on how its individual segments look
     * @param {object} route
     * @param {number} index
     * @return {object}
     */
    function rankRoute(route, index) {
      const score = route.default
        ? 0
        : segmentize(route.path).reduce((score, segment) => {
            score += SEGMENT_POINTS;

            if (isRootSegment(segment)) {
              score += ROOT_POINTS;
            } else if (isDynamic(segment)) {
              score += DYNAMIC_POINTS;
            } else if (isSplat(segment)) {
              score -= SEGMENT_POINTS + SPLAT_PENALTY;
            } else {
              score += STATIC_POINTS;
            }

            return score;
          }, 0);

      return { route, score, index };
    }

    /**
     * Give a score to all routes and sort them on that
     * @param {object[]} routes
     * @return {object[]}
     */
    function rankRoutes(routes) {
      return (
        routes
          .map(rankRoute)
          // If two routes have the exact same score, we go by index instead
          .sort((a, b) =>
            a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
          )
      );
    }

    /**
     * Ranks and picks the best route to match. Each segment gets the highest
     * amount of points, then the type of segment gets an additional amount of
     * points where
     *
     *  static > dynamic > splat > root
     *
     * This way we don't have to worry about the order of our routes, let the
     * computers do it.
     *
     * A route looks like this
     *
     *  { path, default, value }
     *
     * And a returned match looks like:
     *
     *  { route, params, uri }
     *
     * @param {object[]} routes
     * @param {string} uri
     * @return {?object}
     */
    function pick(routes, uri) {
      let match;
      let default_;

      const [uriPathname] = uri.split("?");
      const uriSegments = segmentize(uriPathname);
      const isRootUri = uriSegments[0] === "";
      const ranked = rankRoutes(routes);

      for (let i = 0, l = ranked.length; i < l; i++) {
        const route = ranked[i].route;
        let missed = false;

        if (route.default) {
          default_ = {
            route,
            params: {},
            uri
          };
          continue;
        }

        const routeSegments = segmentize(route.path);
        const params = {};
        const max = Math.max(uriSegments.length, routeSegments.length);
        let index = 0;

        for (; index < max; index++) {
          const routeSegment = routeSegments[index];
          const uriSegment = uriSegments[index];

          if (routeSegment !== undefined && isSplat(routeSegment)) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/* or /files/*splatname
            const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

            params[splatName] = uriSegments
              .slice(index)
              .map(decodeURIComponent)
              .join("/");
            break;
          }

          if (uriSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/:userId
            missed = true;
            break;
          }

          let dynamicMatch = paramRe.exec(routeSegment);

          if (dynamicMatch && !isRootUri) {
            const value = decodeURIComponent(uriSegment);
            params[dynamicMatch[1]] = value;
          } else if (routeSegment !== uriSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/:id/profile
            missed = true;
            break;
          }
        }

        if (!missed) {
          match = {
            route,
            params,
            uri: "/" + uriSegments.slice(0, index).join("/")
          };
          break;
        }
      }

      return match || default_ || null;
    }

    /**
     * Check if the `path` matches the `uri`.
     * @param {string} path
     * @param {string} uri
     * @return {?object}
     */
    function match(route, uri) {
      return pick([route], uri);
    }

    /**
     * Add the query to the pathname if a query is given
     * @param {string} pathname
     * @param {string} [query]
     * @return {string}
     */
    function addQuery(pathname, query) {
      return pathname + (query ? `?${query}` : "");
    }

    /**
     * Resolve URIs as though every path is a directory, no files. Relative URIs
     * in the browser can feel awkward because not only can you be "in a directory",
     * you can be "at a file", too. For example:
     *
     *  browserSpecResolve('foo', '/bar/') => /bar/foo
     *  browserSpecResolve('foo', '/bar') => /foo
     *
     * But on the command line of a file system, it's not as complicated. You can't
     * `cd` from a file, only directories. This way, links have to know less about
     * their current path. To go deeper you can do this:
     *
     *  <Link to="deeper"/>
     *  // instead of
     *  <Link to=`{${props.uri}/deeper}`/>
     *
     * Just like `cd`, if you want to go deeper from the command line, you do this:
     *
     *  cd deeper
     *  # not
     *  cd $(pwd)/deeper
     *
     * By treating every path as a directory, linking to relative paths should
     * require less contextual information and (fingers crossed) be more intuitive.
     * @param {string} to
     * @param {string} base
     * @return {string}
     */
    function resolve(to, base) {
      // /foo/bar, /baz/qux => /foo/bar
      if (startsWith(to, "/")) {
        return to;
      }

      const [toPathname, toQuery] = to.split("?");
      const [basePathname] = base.split("?");
      const toSegments = segmentize(toPathname);
      const baseSegments = segmentize(basePathname);

      // ?a=b, /users?b=c => /users?a=b
      if (toSegments[0] === "") {
        return addQuery(basePathname, toQuery);
      }

      // profile, /users/789 => /users/789/profile
      if (!startsWith(toSegments[0], ".")) {
        const pathname = baseSegments.concat(toSegments).join("/");

        return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
      }

      // ./       , /users/123 => /users/123
      // ../      , /users/123 => /users
      // ../..    , /users/123 => /
      // ../../one, /a/b/c/d   => /a/b/one
      // .././one , /a/b/c/d   => /a/b/c/one
      const allSegments = baseSegments.concat(toSegments);
      const segments = [];

      allSegments.forEach(segment => {
        if (segment === "..") {
          segments.pop();
        } else if (segment !== ".") {
          segments.push(segment);
        }
      });

      return addQuery("/" + segments.join("/"), toQuery);
    }

    /**
     * Combines the `basepath` and the `path` into one path.
     * @param {string} basepath
     * @param {string} path
     */
    function combinePaths(basepath, path) {
      return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
    }

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
      return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      );
    }

    /* node_modules/svelte-routing/src/Router.svelte generated by Svelte v3.16.0 */

    function create_fragment(ctx) {
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 32768) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $base;
    	let $location;
    	let $routes;
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	validate_store(routes, "routes");
    	component_subscribe($$self, routes, value => $$invalidate(8, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false;
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);
    	validate_store(location, "location");
    	component_subscribe($$self, location, value => $$invalidate(7, $location = value));

    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	validate_store(base, "base");
    	component_subscribe($$self, base, value => $$invalidate(6, $base = value));

    	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
    		if (activeRoute === null) {
    			return base;
    		}

    		const { path: basepath } = base;
    		const { route, uri } = activeRoute;

    		const path = route.default
    		? basepath
    		: route.path.replace(/\*.*$/, "");

    		return { path, uri };
    	});

    	function registerRoute(route) {
    		const { path: basepath } = $base;
    		let { path } = route;
    		route._path = path;
    		route.path = combinePaths(basepath, path);

    		if (typeof window === "undefined") {
    			if (hasActiveRoute) {
    				return;
    			}

    			const matchingRoute = match(route, $location.pathname);

    			if (matchingRoute) {
    				activeRoute.set(matchingRoute);
    				hasActiveRoute = true;
    			}
    		} else {
    			routes.update(rs => {
    				rs.push(route);
    				return rs;
    			});
    		}
    	}

    	function unregisterRoute(route) {
    		routes.update(rs => {
    			const index = rs.indexOf(route);
    			rs.splice(index, 1);
    			return rs;
    		});
    	}

    	if (!locationContext) {
    		onMount(() => {
    			const unlisten = globalHistory.listen(history => {
    				location.set(history.location);
    			});

    			return unlisten;
    		});

    		setContext(LOCATION, location);
    	}

    	setContext(ROUTER, {
    		activeRoute,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute
    	});

    	const writable_props = ["basepath", "url"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$props => {
    		if ("basepath" in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ("url" in $$props) $$invalidate(4, url = $$props.url);
    		if ("$$scope" in $$props) $$invalidate(15, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			basepath,
    			url,
    			hasActiveRoute,
    			$base,
    			$location,
    			$routes
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("basepath" in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ("url" in $$props) $$invalidate(4, url = $$props.url);
    		if ("hasActiveRoute" in $$props) hasActiveRoute = $$props.hasActiveRoute;
    		if ("$base" in $$props) base.set($base = $$props.$base);
    		if ("$location" in $$props) location.set($location = $$props.$location);
    		if ("$routes" in $$props) routes.set($routes = $$props.$routes);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 64) {
    			 {
    				const { path: basepath } = $base;

    				routes.update(rs => {
    					rs.forEach(r => r.path = combinePaths(basepath, r._path));
    					return rs;
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 384) {
    			 {
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}
    	};

    	return [
    		routes,
    		location,
    		base,
    		basepath,
    		url,
    		hasActiveRoute,
    		$base,
    		$location,
    		$routes,
    		locationContext,
    		routerContext,
    		activeRoute,
    		routerBase,
    		registerRoute,
    		unregisterRoute,
    		$$scope,
    		$$slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get basepath() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set basepath(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/svelte-routing/src/Route.svelte generated by Svelte v3.16.0 */

    const get_default_slot_changes = dirty => ({
    	params: dirty & /*routeParams*/ 2,
    	location: dirty & /*$location*/ 16
    });

    const get_default_slot_context = ctx => ({
    	params: /*routeParams*/ ctx[1],
    	location: /*$location*/ ctx[4]
    });

    // (40:0) {#if $activeRoute !== null && $activeRoute.route === route}
    function create_if_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(40:0) {#if $activeRoute !== null && $activeRoute.route === route}",
    		ctx
    	});

    	return block;
    }

    // (43:2) {:else}
    function create_else_block(ctx) {
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[13].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], get_default_slot_context);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope, routeParams, $location*/ 4114) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[12], get_default_slot_context), get_slot_changes(default_slot_template, /*$$scope*/ ctx[12], dirty, get_default_slot_changes));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(43:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:2) {#if component !== null}
    function create_if_block_1(ctx) {
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[4] },
    		/*routeParams*/ ctx[1],
    		/*routeProps*/ ctx[2]
    	];

    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = dirty & /*$location, routeParams, routeProps*/ 22
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 16 && ({ location: /*$location*/ ctx[4] }),
    					dirty & /*routeParams*/ 2 && get_spread_object(/*routeParams*/ ctx[1]),
    					dirty & /*routeProps*/ 4 && get_spread_object(/*routeProps*/ ctx[2])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[3] !== null && /*$activeRoute*/ ctx[3].route === /*route*/ ctx[6] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[3] !== null && /*$activeRoute*/ ctx[3].route === /*route*/ ctx[6]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	validate_store(activeRoute, "activeRoute");
    	component_subscribe($$self, activeRoute, value => $$invalidate(3, $activeRoute = value));
    	const location = getContext(LOCATION);
    	validate_store(location, "location");
    	component_subscribe($$self, location, value => $$invalidate(4, $location = value));
    	const route = { path, default: path === "" };
    	let routeParams = {};
    	let routeProps = {};
    	registerRoute(route);

    	if (typeof window !== "undefined") {
    		onDestroy(() => {
    			unregisterRoute(route);
    		});
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(11, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("path" in $$new_props) $$invalidate(7, path = $$new_props.path);
    		if ("component" in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ("$$scope" in $$new_props) $$invalidate(12, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			path,
    			component,
    			routeParams,
    			routeProps,
    			$activeRoute,
    			$location
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(11, $$props = assign(assign({}, $$props), $$new_props));
    		if ("path" in $$props) $$invalidate(7, path = $$new_props.path);
    		if ("component" in $$props) $$invalidate(0, component = $$new_props.component);
    		if ("routeParams" in $$props) $$invalidate(1, routeParams = $$new_props.routeParams);
    		if ("routeProps" in $$props) $$invalidate(2, routeProps = $$new_props.routeProps);
    		if ("$activeRoute" in $$props) activeRoute.set($activeRoute = $$new_props.$activeRoute);
    		if ("$location" in $$props) location.set($location = $$new_props.$location);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$activeRoute*/ 8) {
    			 if ($activeRoute && $activeRoute.route === route) {
    				$$invalidate(1, routeParams = $activeRoute.params);
    			}
    		}

    		 {
    			const { path, component, ...rest } = $$props;
    			$$invalidate(2, routeProps = rest);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		routeParams,
    		routeProps,
    		$activeRoute,
    		$location,
    		activeRoute,
    		route,
    		path,
    		registerRoute,
    		unregisterRoute,
    		location,
    		$$props,
    		$$scope,
    		$$slots
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { path: 7, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/svelte-routing/src/Link.svelte generated by Svelte v3.16.0 */
    const file = "node_modules/svelte-routing/src/Link.svelte";

    function create_fragment$2(ctx) {
    	let a;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let a_levels = [
    		{ href: /*href*/ ctx[0] },
    		{ "aria-current": /*ariaCurrent*/ ctx[2] },
    		/*props*/ ctx[1]
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			set_attributes(a, a_data);
    			add_location(a, file, 40, 0, 1249);
    			dispose = listen_dev(a, "click", /*onClick*/ ctx[5], false, false, false);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 32768) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
    			}

    			set_attributes(a, get_spread_update(a_levels, [
    				dirty & /*href*/ 1 && ({ href: /*href*/ ctx[0] }),
    				dirty & /*ariaCurrent*/ 4 && ({ "aria-current": /*ariaCurrent*/ ctx[2] }),
    				dirty & /*props*/ 2 && /*props*/ ctx[1]
    			]));
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $base;
    	let $location;
    	let { to = "#" } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = () => ({}) } = $$props;
    	const { base } = getContext(ROUTER);
    	validate_store(base, "base");
    	component_subscribe($$self, base, value => $$invalidate(12, $base = value));
    	const location = getContext(LOCATION);
    	validate_store(location, "location");
    	component_subscribe($$self, location, value => $$invalidate(13, $location = value));
    	const dispatch = createEventDispatcher();
    	let href, isPartiallyCurrent, isCurrent, props;

    	function onClick(event) {
    		dispatch("click", event);

    		if (shouldNavigate(event)) {
    			event.preventDefault();
    			const shouldReplace = $location.pathname === href || replace;
    			navigate(href, { state, replace: shouldReplace });
    		}
    	}

    	const writable_props = ["to", "replace", "state", "getProps"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Link> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$props => {
    		if ("to" in $$props) $$invalidate(6, to = $$props.to);
    		if ("replace" in $$props) $$invalidate(7, replace = $$props.replace);
    		if ("state" in $$props) $$invalidate(8, state = $$props.state);
    		if ("getProps" in $$props) $$invalidate(9, getProps = $$props.getProps);
    		if ("$$scope" in $$props) $$invalidate(15, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			to,
    			replace,
    			state,
    			getProps,
    			href,
    			isPartiallyCurrent,
    			isCurrent,
    			props,
    			$base,
    			$location,
    			ariaCurrent
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("to" in $$props) $$invalidate(6, to = $$props.to);
    		if ("replace" in $$props) $$invalidate(7, replace = $$props.replace);
    		if ("state" in $$props) $$invalidate(8, state = $$props.state);
    		if ("getProps" in $$props) $$invalidate(9, getProps = $$props.getProps);
    		if ("href" in $$props) $$invalidate(0, href = $$props.href);
    		if ("isPartiallyCurrent" in $$props) $$invalidate(10, isPartiallyCurrent = $$props.isPartiallyCurrent);
    		if ("isCurrent" in $$props) $$invalidate(11, isCurrent = $$props.isCurrent);
    		if ("props" in $$props) $$invalidate(1, props = $$props.props);
    		if ("$base" in $$props) base.set($base = $$props.$base);
    		if ("$location" in $$props) location.set($location = $$props.$location);
    		if ("ariaCurrent" in $$props) $$invalidate(2, ariaCurrent = $$props.ariaCurrent);
    	};

    	let ariaCurrent;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*to, $base*/ 4160) {
    			 $$invalidate(0, href = to === "/" ? $base.uri : resolve(to, $base.uri));
    		}

    		if ($$self.$$.dirty & /*$location, href*/ 8193) {
    			 $$invalidate(10, isPartiallyCurrent = startsWith($location.pathname, href));
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 8193) {
    			 $$invalidate(11, isCurrent = href === $location.pathname);
    		}

    		if ($$self.$$.dirty & /*isCurrent*/ 2048) {
    			 $$invalidate(2, ariaCurrent = isCurrent ? "page" : undefined);
    		}

    		if ($$self.$$.dirty & /*getProps, $location, href, isPartiallyCurrent, isCurrent*/ 11777) {
    			 $$invalidate(1, props = getProps({
    				location: $location,
    				href,
    				isPartiallyCurrent,
    				isCurrent
    			}));
    		}
    	};

    	return [
    		href,
    		props,
    		ariaCurrent,
    		base,
    		location,
    		onClick,
    		to,
    		replace,
    		state,
    		getProps,
    		isPartiallyCurrent,
    		isCurrent,
    		$base,
    		$location,
    		dispatch,
    		$$scope,
    		$$slots
    	];
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { to: 6, replace: 7, state: 8, getProps: 9 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Link",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get to() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replace() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replace(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get state() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getProps() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getProps(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const defaultState = {
        openedItems: [],
        guessedItems: [],
    	toRemove: null,
    	gameStart: new Date()
    };

    const boardState = writable(defaultState);

    function createCount() {
    	const { subscribe, set, update } = writable(new Date());

    	const interval = setInterval(() => {
    		set(new Date());
    	}, 1000);

    	return {
    		subscribe,
    		stop: () => {
    			clearInterval(interval);
    		},
    		reset: () => {
    			clearInterval(interval);
    			return set(new Date())
    		}
    	};
    }

    const count = createCount();

    /* src/components/Card.svelte generated by Svelte v3.16.0 */
    const file$1 = "src/components/Card.svelte";

    function create_fragment$3(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t;
    	let div1;
    	let img1;
    	let img1_src_value;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			img0 = element("img");
    			t = space();
    			div1 = element("div");
    			img1 = element("img");
    			if (img0.src !== (img0_src_value = /*symbol*/ ctx[0])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", /*symbol*/ ctx[0]);
    			attr_dev(img0, "class", "svelte-g9s1x2");
    			add_location(img0, file$1, 2, 46, 143);
    			attr_dev(div0, "class", "card__face card__face--front svelte-g9s1x2");
    			add_location(div0, file$1, 2, 4, 101);
    			if (img1.src !== (img1_src_value = "assets/bg.jpg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "bg");
    			attr_dev(img1, "class", "svelte-g9s1x2");
    			add_location(img1, file$1, 4, 8, 249);
    			attr_dev(div1, "class", "card__face card__face--back svelte-g9s1x2");
    			attr_dev(div1, "title", /*symbol*/ ctx[0]);
    			add_location(div1, file$1, 3, 4, 185);
    			attr_dev(div2, "class", "card svelte-g9s1x2");
    			toggle_class(div2, "flipped", /*front*/ ctx[1]);
    			add_location(div2, file$1, 1, 2, 34);
    			attr_dev(div3, "class", "scene scene--card svelte-g9s1x2");
    			add_location(div3, file$1, 0, 0, 0);
    			dispose = listen_dev(div2, "click", /*wrapCard*/ ctx[2], false, false, false);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, img0);
    			append_dev(div2, t);
    			append_dev(div2, div1);
    			append_dev(div1, img1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*symbol*/ 1 && img0.src !== (img0_src_value = /*symbol*/ ctx[0])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (dirty & /*symbol*/ 1) {
    				attr_dev(img0, "alt", /*symbol*/ ctx[0]);
    			}

    			if (dirty & /*symbol*/ 1) {
    				attr_dev(div1, "title", /*symbol*/ ctx[0]);
    			}

    			if (dirty & /*front*/ 2) {
    				toggle_class(div2, "flipped", /*front*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $boardState;
    	validate_store(boardState, "boardState");
    	component_subscribe($$self, boardState, $$value => $$invalidate(3, $boardState = $$value));
    	const dispatch = createEventDispatcher();
    	let { symbol } = $$props;

    	boardState.subscribe(state => {
    		if ($boardState.guessedItems.indexOf(symbol) > -1) return;

    		if ($boardState.toRemove === symbol && !front && $boardState.guessedItems.indexOf(symbol) == -1) {
    			$$invalidate(1, front = !front);

    			boardState.update(state => {
    				const newState = { ...state };
    				newState.toRemove = null;
    				newState.guessedItems = state.guessedItems;
    				return newState;
    			});
    		}
    	});

    	let front = true;

    	function wrapCard() {
    		if ($boardState.guessedItems.indexOf(symbol) > -1) return;
    		dispatch("turn", { name: symbol });

    		boardState.update(state => {
    			state.openedItems.push(symbol);
    			return { ...state };
    		});

    		$$invalidate(1, front = !front);
    	}

    	const writable_props = ["symbol"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("symbol" in $$props) $$invalidate(0, symbol = $$props.symbol);
    	};

    	$$self.$capture_state = () => {
    		return { symbol, front, $boardState };
    	};

    	$$self.$inject_state = $$props => {
    		if ("symbol" in $$props) $$invalidate(0, symbol = $$props.symbol);
    		if ("front" in $$props) $$invalidate(1, front = $$props.front);
    		if ("$boardState" in $$props) boardState.set($boardState = $$props.$boardState);
    	};

    	return [symbol, front, wrapCard];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { symbol: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (/*symbol*/ ctx[0] === undefined && !("symbol" in props)) {
    			console.warn("<Card> was created without expected prop 'symbol'");
    		}
    	}

    	get symbol() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set symbol(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function forwardEventsBuilder(component, additionalEvents = []) {
      const events = [
        'focus', 'blur',
        'fullscreenchange', 'fullscreenerror', 'scroll',
        'cut', 'copy', 'paste',
        'keydown', 'keypress', 'keyup',
        'auxclick', 'click', 'contextmenu', 'dblclick', 'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseover', 'mouseout', 'mouseup', 'pointerlockchange', 'pointerlockerror', 'select', 'wheel',
        'drag', 'dragend', 'dragenter', 'dragstart', 'dragleave', 'dragover', 'drop',
        'touchcancel', 'touchend', 'touchmove', 'touchstart',
        'pointerover', 'pointerenter', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'pointerleave', 'gotpointercapture', 'lostpointercapture',
        ...additionalEvents
      ];

      function forward(e) {
        bubble(component, e);
      }

      return node => {
        const destructors = [];

        for (let i = 0; i < events.length; i++) {
          destructors.push(listen(node, events[i], forward));
        }

        return {
          destroy: () => {
            for (let i = 0; i < destructors.length; i++) {
              destructors[i]();
            }
          }
        }
      };
    }

    function exclude(obj, keys) {
      let names = Object.getOwnPropertyNames(obj);
      const newObj = {};

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const cashIndex = name.indexOf('$');
        if (cashIndex !== -1 && keys.indexOf(name.substring(0, cashIndex + 1)) !== -1) {
          continue;
        }
        if (keys.indexOf(name) !== -1) {
          continue;
        }
        newObj[name] = obj[name];
      }

      return newObj;
    }

    function useActions(node, actions) {
      let objects = [];

      if (actions) {
        for (let i = 0; i < actions.length; i++) {
          const isArray = Array.isArray(actions[i]);
          const action = isArray ? actions[i][0] : actions[i];
          if (isArray && actions[i].length > 1) {
            objects.push(action(node, actions[i][1]));
          } else {
            objects.push(action(node));
          }
        }
      }

      return {
        update(actions) {
          if ((actions && actions.length || 0) != objects.length) {
            throw new Error('You must not change the length of an actions array.');
          }

          if (actions) {
            for (let i = 0; i < actions.length; i++) {
              if (objects[i] && 'update' in objects[i]) {
                const isArray = Array.isArray(actions[i]);
                if (isArray && actions[i].length > 1) {
                  objects[i].update(actions[i][1]);
                } else {
                  objects[i].update();
                }
              }
            }
          }
        },

        destroy() {
          for (let i = 0; i < objects.length; i++) {
            if (objects[i] && 'destroy' in objects[i]) {
              objects[i].destroy();
            }
          }
        }
      }
    }

    /**
     * Stores result from supportsCssVariables to avoid redundant processing to
     * detect CSS custom variable support.
     */
    var supportsCssVariables_;
    function detectEdgePseudoVarBug(windowObj) {
        // Detect versions of Edge with buggy var() support
        // See: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/11495448/
        var document = windowObj.document;
        var node = document.createElement('div');
        node.className = 'mdc-ripple-surface--test-edge-var-bug';
        // Append to head instead of body because this script might be invoked in the
        // head, in which case the body doesn't exist yet. The probe works either way.
        document.head.appendChild(node);
        // The bug exists if ::before style ends up propagating to the parent element.
        // Additionally, getComputedStyle returns null in iframes with display: "none" in Firefox,
        // but Firefox is known to support CSS custom properties correctly.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=548397
        var computedStyle = windowObj.getComputedStyle(node);
        var hasPseudoVarBug = computedStyle !== null && computedStyle.borderTopStyle === 'solid';
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
        return hasPseudoVarBug;
    }
    function supportsCssVariables(windowObj, forceRefresh) {
        if (forceRefresh === void 0) { forceRefresh = false; }
        var CSS = windowObj.CSS;
        var supportsCssVars = supportsCssVariables_;
        if (typeof supportsCssVariables_ === 'boolean' && !forceRefresh) {
            return supportsCssVariables_;
        }
        var supportsFunctionPresent = CSS && typeof CSS.supports === 'function';
        if (!supportsFunctionPresent) {
            return false;
        }
        var explicitlySupportsCssVars = CSS.supports('--css-vars', 'yes');
        // See: https://bugs.webkit.org/show_bug.cgi?id=154669
        // See: README section on Safari
        var weAreFeatureDetectingSafari10plus = (CSS.supports('(--css-vars: yes)') &&
            CSS.supports('color', '#00000000'));
        if (explicitlySupportsCssVars || weAreFeatureDetectingSafari10plus) {
            supportsCssVars = !detectEdgePseudoVarBug(windowObj);
        }
        else {
            supportsCssVars = false;
        }
        if (!forceRefresh) {
            supportsCssVariables_ = supportsCssVars;
        }
        return supportsCssVars;
    }
    function getNormalizedEventCoords(evt, pageOffset, clientRect) {
        if (!evt) {
            return { x: 0, y: 0 };
        }
        var x = pageOffset.x, y = pageOffset.y;
        var documentX = x + clientRect.left;
        var documentY = y + clientRect.top;
        var normalizedX;
        var normalizedY;
        // Determine touch point relative to the ripple container.
        if (evt.type === 'touchstart') {
            var touchEvent = evt;
            normalizedX = touchEvent.changedTouches[0].pageX - documentX;
            normalizedY = touchEvent.changedTouches[0].pageY - documentY;
        }
        else {
            var mouseEvent = evt;
            normalizedX = mouseEvent.pageX - documentX;
            normalizedY = mouseEvent.pageY - documentY;
        }
        return { x: normalizedX, y: normalizedY };
    }
    //# sourceMappingURL=util.js.map

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function __values(o) {
        var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
        if (m) return m.call(o);
        return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
    }

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    }

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFoundation = /** @class */ (function () {
        function MDCFoundation(adapter) {
            if (adapter === void 0) { adapter = {}; }
            this.adapter_ = adapter;
        }
        Object.defineProperty(MDCFoundation, "cssClasses", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports every
                // CSS class the foundation class needs as a property. e.g. {ACTIVE: 'mdc-component--active'}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "strings", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports all
                // semantic strings as constants. e.g. {ARIA_ROLE: 'tablist'}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "numbers", {
            get: function () {
                // Classes extending MDCFoundation should implement this method to return an object which exports all
                // of its semantic numbers as constants. e.g. {ANIMATION_DELAY_MS: 350}
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFoundation, "defaultAdapter", {
            get: function () {
                // Classes extending MDCFoundation may choose to implement this getter in order to provide a convenient
                // way of viewing the necessary methods of an adapter. In the future, this could also be used for adapter
                // validation.
                return {};
            },
            enumerable: true,
            configurable: true
        });
        MDCFoundation.prototype.init = function () {
            // Subclasses should override this method to perform initialization routines (registering events, etc.)
        };
        MDCFoundation.prototype.destroy = function () {
            // Subclasses should override this method to perform de-initialization routines (de-registering events, etc.)
        };
        return MDCFoundation;
    }());
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCComponent = /** @class */ (function () {
        function MDCComponent(root, foundation) {
            var args = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                args[_i - 2] = arguments[_i];
            }
            this.root_ = root;
            this.initialize.apply(this, __spread(args));
            // Note that we initialize foundation here and not within the constructor's default param so that
            // this.root_ is defined and can be used within the foundation class.
            this.foundation_ = foundation === undefined ? this.getDefaultFoundation() : foundation;
            this.foundation_.init();
            this.initialSyncWithDOM();
        }
        MDCComponent.attachTo = function (root) {
            // Subclasses which extend MDCBase should provide an attachTo() method that takes a root element and
            // returns an instantiated component with its root set to that element. Also note that in the cases of
            // subclasses, an explicit foundation class will not have to be passed in; it will simply be initialized
            // from getDefaultFoundation().
            return new MDCComponent(root, new MDCFoundation({}));
        };
        /* istanbul ignore next: method param only exists for typing purposes; it does not need to be unit tested */
        MDCComponent.prototype.initialize = function () {
            var _args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _args[_i] = arguments[_i];
            }
            // Subclasses can override this to do any additional setup work that would be considered part of a
            // "constructor". Essentially, it is a hook into the parent constructor before the foundation is
            // initialized. Any additional arguments besides root and foundation will be passed in here.
        };
        MDCComponent.prototype.getDefaultFoundation = function () {
            // Subclasses must override this method to return a properly configured foundation class for the
            // component.
            throw new Error('Subclasses must override getDefaultFoundation to return a properly configured ' +
                'foundation class');
        };
        MDCComponent.prototype.initialSyncWithDOM = function () {
            // Subclasses should override this method if they need to perform work to synchronize with a host DOM
            // object. An example of this would be a form control wrapper that needs to synchronize its internal state
            // to some property or attribute of the host DOM. Please note: this is *not* the place to perform DOM
            // reads/writes that would cause layout / paint, as this is called synchronously from within the constructor.
        };
        MDCComponent.prototype.destroy = function () {
            // Subclasses may implement this method to release any resources / deregister any listeners they have
            // attached. An example of this might be deregistering a resize event from the window object.
            this.foundation_.destroy();
        };
        MDCComponent.prototype.listen = function (evtType, handler, options) {
            this.root_.addEventListener(evtType, handler, options);
        };
        MDCComponent.prototype.unlisten = function (evtType, handler, options) {
            this.root_.removeEventListener(evtType, handler, options);
        };
        /**
         * Fires a cross-browser-compatible custom event from the component root of the given type, with the given data.
         */
        MDCComponent.prototype.emit = function (evtType, evtData, shouldBubble) {
            if (shouldBubble === void 0) { shouldBubble = false; }
            var evt;
            if (typeof CustomEvent === 'function') {
                evt = new CustomEvent(evtType, {
                    bubbles: shouldBubble,
                    detail: evtData,
                });
            }
            else {
                evt = document.createEvent('CustomEvent');
                evt.initCustomEvent(evtType, shouldBubble, false, evtData);
            }
            this.root_.dispatchEvent(evt);
        };
        return MDCComponent;
    }());
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2019 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    /**
     * Stores result from applyPassive to avoid redundant processing to detect
     * passive event listener support.
     */
    var supportsPassive_;
    /**
     * Determine whether the current browser supports passive event listeners, and
     * if so, use them.
     */
    function applyPassive(globalObj, forceRefresh) {
        if (globalObj === void 0) { globalObj = window; }
        if (forceRefresh === void 0) { forceRefresh = false; }
        if (supportsPassive_ === undefined || forceRefresh) {
            var isSupported_1 = false;
            try {
                globalObj.document.addEventListener('test', function () { return undefined; }, {
                    get passive() {
                        isSupported_1 = true;
                        return isSupported_1;
                    },
                });
            }
            catch (e) {
            } // tslint:disable-line:no-empty cannot throw error due to tests. tslint also disables console.log.
            supportsPassive_ = isSupported_1;
        }
        return supportsPassive_ ? { passive: true } : false;
    }
    //# sourceMappingURL=events.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    /**
     * @fileoverview A "ponyfill" is a polyfill that doesn't modify the global prototype chain.
     * This makes ponyfills safer than traditional polyfills, especially for libraries like MDC.
     */
    function closest(element, selector) {
        if (element.closest) {
            return element.closest(selector);
        }
        var el = element;
        while (el) {
            if (matches(el, selector)) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }
    function matches(element, selector) {
        var nativeMatches = element.matches
            || element.webkitMatchesSelector
            || element.msMatchesSelector;
        return nativeMatches.call(element, selector);
    }
    //# sourceMappingURL=ponyfill.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses = {
        // Ripple is a special case where the "root" component is really a "mixin" of sorts,
        // given that it's an 'upgrade' to an existing component. That being said it is the root
        // CSS class that all other CSS classes derive from.
        BG_FOCUSED: 'mdc-ripple-upgraded--background-focused',
        FG_ACTIVATION: 'mdc-ripple-upgraded--foreground-activation',
        FG_DEACTIVATION: 'mdc-ripple-upgraded--foreground-deactivation',
        ROOT: 'mdc-ripple-upgraded',
        UNBOUNDED: 'mdc-ripple-upgraded--unbounded',
    };
    var strings = {
        VAR_FG_SCALE: '--mdc-ripple-fg-scale',
        VAR_FG_SIZE: '--mdc-ripple-fg-size',
        VAR_FG_TRANSLATE_END: '--mdc-ripple-fg-translate-end',
        VAR_FG_TRANSLATE_START: '--mdc-ripple-fg-translate-start',
        VAR_LEFT: '--mdc-ripple-left',
        VAR_TOP: '--mdc-ripple-top',
    };
    var numbers = {
        DEACTIVATION_TIMEOUT_MS: 225,
        FG_DEACTIVATION_MS: 150,
        INITIAL_ORIGIN_SCALE: 0.6,
        PADDING: 10,
        TAP_DELAY_MS: 300,
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    // Activation events registered on the root element of each instance for activation
    var ACTIVATION_EVENT_TYPES = [
        'touchstart', 'pointerdown', 'mousedown', 'keydown',
    ];
    // Deactivation events registered on documentElement when a pointer-related down event occurs
    var POINTER_DEACTIVATION_EVENT_TYPES = [
        'touchend', 'pointerup', 'mouseup', 'contextmenu',
    ];
    // simultaneous nested activations
    var activatedTargets = [];
    var MDCRippleFoundation = /** @class */ (function (_super) {
        __extends(MDCRippleFoundation, _super);
        function MDCRippleFoundation(adapter) {
            var _this = _super.call(this, __assign({}, MDCRippleFoundation.defaultAdapter, adapter)) || this;
            _this.activationAnimationHasEnded_ = false;
            _this.activationTimer_ = 0;
            _this.fgDeactivationRemovalTimer_ = 0;
            _this.fgScale_ = '0';
            _this.frame_ = { width: 0, height: 0 };
            _this.initialSize_ = 0;
            _this.layoutFrame_ = 0;
            _this.maxRadius_ = 0;
            _this.unboundedCoords_ = { left: 0, top: 0 };
            _this.activationState_ = _this.defaultActivationState_();
            _this.activationTimerCallback_ = function () {
                _this.activationAnimationHasEnded_ = true;
                _this.runDeactivationUXLogicIfReady_();
            };
            _this.activateHandler_ = function (e) { return _this.activate_(e); };
            _this.deactivateHandler_ = function () { return _this.deactivate_(); };
            _this.focusHandler_ = function () { return _this.handleFocus(); };
            _this.blurHandler_ = function () { return _this.handleBlur(); };
            _this.resizeHandler_ = function () { return _this.layout(); };
            return _this;
        }
        Object.defineProperty(MDCRippleFoundation, "cssClasses", {
            get: function () {
                return cssClasses;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "strings", {
            get: function () {
                return strings;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "numbers", {
            get: function () {
                return numbers;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCRippleFoundation, "defaultAdapter", {
            get: function () {
                return {
                    addClass: function () { return undefined; },
                    browserSupportsCssVars: function () { return true; },
                    computeBoundingRect: function () { return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 }); },
                    containsEventTarget: function () { return true; },
                    deregisterDocumentInteractionHandler: function () { return undefined; },
                    deregisterInteractionHandler: function () { return undefined; },
                    deregisterResizeHandler: function () { return undefined; },
                    getWindowPageOffset: function () { return ({ x: 0, y: 0 }); },
                    isSurfaceActive: function () { return true; },
                    isSurfaceDisabled: function () { return true; },
                    isUnbounded: function () { return true; },
                    registerDocumentInteractionHandler: function () { return undefined; },
                    registerInteractionHandler: function () { return undefined; },
                    registerResizeHandler: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    updateCssVariable: function () { return undefined; },
                };
            },
            enumerable: true,
            configurable: true
        });
        MDCRippleFoundation.prototype.init = function () {
            var _this = this;
            var supportsPressRipple = this.supportsPressRipple_();
            this.registerRootHandlers_(supportsPressRipple);
            if (supportsPressRipple) {
                var _a = MDCRippleFoundation.cssClasses, ROOT_1 = _a.ROOT, UNBOUNDED_1 = _a.UNBOUNDED;
                requestAnimationFrame(function () {
                    _this.adapter_.addClass(ROOT_1);
                    if (_this.adapter_.isUnbounded()) {
                        _this.adapter_.addClass(UNBOUNDED_1);
                        // Unbounded ripples need layout logic applied immediately to set coordinates for both shade and ripple
                        _this.layoutInternal_();
                    }
                });
            }
        };
        MDCRippleFoundation.prototype.destroy = function () {
            var _this = this;
            if (this.supportsPressRipple_()) {
                if (this.activationTimer_) {
                    clearTimeout(this.activationTimer_);
                    this.activationTimer_ = 0;
                    this.adapter_.removeClass(MDCRippleFoundation.cssClasses.FG_ACTIVATION);
                }
                if (this.fgDeactivationRemovalTimer_) {
                    clearTimeout(this.fgDeactivationRemovalTimer_);
                    this.fgDeactivationRemovalTimer_ = 0;
                    this.adapter_.removeClass(MDCRippleFoundation.cssClasses.FG_DEACTIVATION);
                }
                var _a = MDCRippleFoundation.cssClasses, ROOT_2 = _a.ROOT, UNBOUNDED_2 = _a.UNBOUNDED;
                requestAnimationFrame(function () {
                    _this.adapter_.removeClass(ROOT_2);
                    _this.adapter_.removeClass(UNBOUNDED_2);
                    _this.removeCssVars_();
                });
            }
            this.deregisterRootHandlers_();
            this.deregisterDeactivationHandlers_();
        };
        /**
         * @param evt Optional event containing position information.
         */
        MDCRippleFoundation.prototype.activate = function (evt) {
            this.activate_(evt);
        };
        MDCRippleFoundation.prototype.deactivate = function () {
            this.deactivate_();
        };
        MDCRippleFoundation.prototype.layout = function () {
            var _this = this;
            if (this.layoutFrame_) {
                cancelAnimationFrame(this.layoutFrame_);
            }
            this.layoutFrame_ = requestAnimationFrame(function () {
                _this.layoutInternal_();
                _this.layoutFrame_ = 0;
            });
        };
        MDCRippleFoundation.prototype.setUnbounded = function (unbounded) {
            var UNBOUNDED = MDCRippleFoundation.cssClasses.UNBOUNDED;
            if (unbounded) {
                this.adapter_.addClass(UNBOUNDED);
            }
            else {
                this.adapter_.removeClass(UNBOUNDED);
            }
        };
        MDCRippleFoundation.prototype.handleFocus = function () {
            var _this = this;
            requestAnimationFrame(function () {
                return _this.adapter_.addClass(MDCRippleFoundation.cssClasses.BG_FOCUSED);
            });
        };
        MDCRippleFoundation.prototype.handleBlur = function () {
            var _this = this;
            requestAnimationFrame(function () {
                return _this.adapter_.removeClass(MDCRippleFoundation.cssClasses.BG_FOCUSED);
            });
        };
        /**
         * We compute this property so that we are not querying information about the client
         * until the point in time where the foundation requests it. This prevents scenarios where
         * client-side feature-detection may happen too early, such as when components are rendered on the server
         * and then initialized at mount time on the client.
         */
        MDCRippleFoundation.prototype.supportsPressRipple_ = function () {
            return this.adapter_.browserSupportsCssVars();
        };
        MDCRippleFoundation.prototype.defaultActivationState_ = function () {
            return {
                activationEvent: undefined,
                hasDeactivationUXRun: false,
                isActivated: false,
                isProgrammatic: false,
                wasActivatedByPointer: false,
                wasElementMadeActive: false,
            };
        };
        /**
         * supportsPressRipple Passed from init to save a redundant function call
         */
        MDCRippleFoundation.prototype.registerRootHandlers_ = function (supportsPressRipple) {
            var _this = this;
            if (supportsPressRipple) {
                ACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                    _this.adapter_.registerInteractionHandler(evtType, _this.activateHandler_);
                });
                if (this.adapter_.isUnbounded()) {
                    this.adapter_.registerResizeHandler(this.resizeHandler_);
                }
            }
            this.adapter_.registerInteractionHandler('focus', this.focusHandler_);
            this.adapter_.registerInteractionHandler('blur', this.blurHandler_);
        };
        MDCRippleFoundation.prototype.registerDeactivationHandlers_ = function (evt) {
            var _this = this;
            if (evt.type === 'keydown') {
                this.adapter_.registerInteractionHandler('keyup', this.deactivateHandler_);
            }
            else {
                POINTER_DEACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                    _this.adapter_.registerDocumentInteractionHandler(evtType, _this.deactivateHandler_);
                });
            }
        };
        MDCRippleFoundation.prototype.deregisterRootHandlers_ = function () {
            var _this = this;
            ACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                _this.adapter_.deregisterInteractionHandler(evtType, _this.activateHandler_);
            });
            this.adapter_.deregisterInteractionHandler('focus', this.focusHandler_);
            this.adapter_.deregisterInteractionHandler('blur', this.blurHandler_);
            if (this.adapter_.isUnbounded()) {
                this.adapter_.deregisterResizeHandler(this.resizeHandler_);
            }
        };
        MDCRippleFoundation.prototype.deregisterDeactivationHandlers_ = function () {
            var _this = this;
            this.adapter_.deregisterInteractionHandler('keyup', this.deactivateHandler_);
            POINTER_DEACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                _this.adapter_.deregisterDocumentInteractionHandler(evtType, _this.deactivateHandler_);
            });
        };
        MDCRippleFoundation.prototype.removeCssVars_ = function () {
            var _this = this;
            var rippleStrings = MDCRippleFoundation.strings;
            var keys = Object.keys(rippleStrings);
            keys.forEach(function (key) {
                if (key.indexOf('VAR_') === 0) {
                    _this.adapter_.updateCssVariable(rippleStrings[key], null);
                }
            });
        };
        MDCRippleFoundation.prototype.activate_ = function (evt) {
            var _this = this;
            if (this.adapter_.isSurfaceDisabled()) {
                return;
            }
            var activationState = this.activationState_;
            if (activationState.isActivated) {
                return;
            }
            // Avoid reacting to follow-on events fired by touch device after an already-processed user interaction
            var previousActivationEvent = this.previousActivationEvent_;
            var isSameInteraction = previousActivationEvent && evt !== undefined && previousActivationEvent.type !== evt.type;
            if (isSameInteraction) {
                return;
            }
            activationState.isActivated = true;
            activationState.isProgrammatic = evt === undefined;
            activationState.activationEvent = evt;
            activationState.wasActivatedByPointer = activationState.isProgrammatic ? false : evt !== undefined && (evt.type === 'mousedown' || evt.type === 'touchstart' || evt.type === 'pointerdown');
            var hasActivatedChild = evt !== undefined && activatedTargets.length > 0 && activatedTargets.some(function (target) { return _this.adapter_.containsEventTarget(target); });
            if (hasActivatedChild) {
                // Immediately reset activation state, while preserving logic that prevents touch follow-on events
                this.resetActivationState_();
                return;
            }
            if (evt !== undefined) {
                activatedTargets.push(evt.target);
                this.registerDeactivationHandlers_(evt);
            }
            activationState.wasElementMadeActive = this.checkElementMadeActive_(evt);
            if (activationState.wasElementMadeActive) {
                this.animateActivation_();
            }
            requestAnimationFrame(function () {
                // Reset array on next frame after the current event has had a chance to bubble to prevent ancestor ripples
                activatedTargets = [];
                if (!activationState.wasElementMadeActive
                    && evt !== undefined
                    && (evt.key === ' ' || evt.keyCode === 32)) {
                    // If space was pressed, try again within an rAF call to detect :active, because different UAs report
                    // active states inconsistently when they're called within event handling code:
                    // - https://bugs.chromium.org/p/chromium/issues/detail?id=635971
                    // - https://bugzilla.mozilla.org/show_bug.cgi?id=1293741
                    // We try first outside rAF to support Edge, which does not exhibit this problem, but will crash if a CSS
                    // variable is set within a rAF callback for a submit button interaction (#2241).
                    activationState.wasElementMadeActive = _this.checkElementMadeActive_(evt);
                    if (activationState.wasElementMadeActive) {
                        _this.animateActivation_();
                    }
                }
                if (!activationState.wasElementMadeActive) {
                    // Reset activation state immediately if element was not made active.
                    _this.activationState_ = _this.defaultActivationState_();
                }
            });
        };
        MDCRippleFoundation.prototype.checkElementMadeActive_ = function (evt) {
            return (evt !== undefined && evt.type === 'keydown') ? this.adapter_.isSurfaceActive() : true;
        };
        MDCRippleFoundation.prototype.animateActivation_ = function () {
            var _this = this;
            var _a = MDCRippleFoundation.strings, VAR_FG_TRANSLATE_START = _a.VAR_FG_TRANSLATE_START, VAR_FG_TRANSLATE_END = _a.VAR_FG_TRANSLATE_END;
            var _b = MDCRippleFoundation.cssClasses, FG_DEACTIVATION = _b.FG_DEACTIVATION, FG_ACTIVATION = _b.FG_ACTIVATION;
            var DEACTIVATION_TIMEOUT_MS = MDCRippleFoundation.numbers.DEACTIVATION_TIMEOUT_MS;
            this.layoutInternal_();
            var translateStart = '';
            var translateEnd = '';
            if (!this.adapter_.isUnbounded()) {
                var _c = this.getFgTranslationCoordinates_(), startPoint = _c.startPoint, endPoint = _c.endPoint;
                translateStart = startPoint.x + "px, " + startPoint.y + "px";
                translateEnd = endPoint.x + "px, " + endPoint.y + "px";
            }
            this.adapter_.updateCssVariable(VAR_FG_TRANSLATE_START, translateStart);
            this.adapter_.updateCssVariable(VAR_FG_TRANSLATE_END, translateEnd);
            // Cancel any ongoing activation/deactivation animations
            clearTimeout(this.activationTimer_);
            clearTimeout(this.fgDeactivationRemovalTimer_);
            this.rmBoundedActivationClasses_();
            this.adapter_.removeClass(FG_DEACTIVATION);
            // Force layout in order to re-trigger the animation.
            this.adapter_.computeBoundingRect();
            this.adapter_.addClass(FG_ACTIVATION);
            this.activationTimer_ = setTimeout(function () { return _this.activationTimerCallback_(); }, DEACTIVATION_TIMEOUT_MS);
        };
        MDCRippleFoundation.prototype.getFgTranslationCoordinates_ = function () {
            var _a = this.activationState_, activationEvent = _a.activationEvent, wasActivatedByPointer = _a.wasActivatedByPointer;
            var startPoint;
            if (wasActivatedByPointer) {
                startPoint = getNormalizedEventCoords(activationEvent, this.adapter_.getWindowPageOffset(), this.adapter_.computeBoundingRect());
            }
            else {
                startPoint = {
                    x: this.frame_.width / 2,
                    y: this.frame_.height / 2,
                };
            }
            // Center the element around the start point.
            startPoint = {
                x: startPoint.x - (this.initialSize_ / 2),
                y: startPoint.y - (this.initialSize_ / 2),
            };
            var endPoint = {
                x: (this.frame_.width / 2) - (this.initialSize_ / 2),
                y: (this.frame_.height / 2) - (this.initialSize_ / 2),
            };
            return { startPoint: startPoint, endPoint: endPoint };
        };
        MDCRippleFoundation.prototype.runDeactivationUXLogicIfReady_ = function () {
            var _this = this;
            // This method is called both when a pointing device is released, and when the activation animation ends.
            // The deactivation animation should only run after both of those occur.
            var FG_DEACTIVATION = MDCRippleFoundation.cssClasses.FG_DEACTIVATION;
            var _a = this.activationState_, hasDeactivationUXRun = _a.hasDeactivationUXRun, isActivated = _a.isActivated;
            var activationHasEnded = hasDeactivationUXRun || !isActivated;
            if (activationHasEnded && this.activationAnimationHasEnded_) {
                this.rmBoundedActivationClasses_();
                this.adapter_.addClass(FG_DEACTIVATION);
                this.fgDeactivationRemovalTimer_ = setTimeout(function () {
                    _this.adapter_.removeClass(FG_DEACTIVATION);
                }, numbers.FG_DEACTIVATION_MS);
            }
        };
        MDCRippleFoundation.prototype.rmBoundedActivationClasses_ = function () {
            var FG_ACTIVATION = MDCRippleFoundation.cssClasses.FG_ACTIVATION;
            this.adapter_.removeClass(FG_ACTIVATION);
            this.activationAnimationHasEnded_ = false;
            this.adapter_.computeBoundingRect();
        };
        MDCRippleFoundation.prototype.resetActivationState_ = function () {
            var _this = this;
            this.previousActivationEvent_ = this.activationState_.activationEvent;
            this.activationState_ = this.defaultActivationState_();
            // Touch devices may fire additional events for the same interaction within a short time.
            // Store the previous event until it's safe to assume that subsequent events are for new interactions.
            setTimeout(function () { return _this.previousActivationEvent_ = undefined; }, MDCRippleFoundation.numbers.TAP_DELAY_MS);
        };
        MDCRippleFoundation.prototype.deactivate_ = function () {
            var _this = this;
            var activationState = this.activationState_;
            // This can happen in scenarios such as when you have a keyup event that blurs the element.
            if (!activationState.isActivated) {
                return;
            }
            var state = __assign({}, activationState);
            if (activationState.isProgrammatic) {
                requestAnimationFrame(function () { return _this.animateDeactivation_(state); });
                this.resetActivationState_();
            }
            else {
                this.deregisterDeactivationHandlers_();
                requestAnimationFrame(function () {
                    _this.activationState_.hasDeactivationUXRun = true;
                    _this.animateDeactivation_(state);
                    _this.resetActivationState_();
                });
            }
        };
        MDCRippleFoundation.prototype.animateDeactivation_ = function (_a) {
            var wasActivatedByPointer = _a.wasActivatedByPointer, wasElementMadeActive = _a.wasElementMadeActive;
            if (wasActivatedByPointer || wasElementMadeActive) {
                this.runDeactivationUXLogicIfReady_();
            }
        };
        MDCRippleFoundation.prototype.layoutInternal_ = function () {
            var _this = this;
            this.frame_ = this.adapter_.computeBoundingRect();
            var maxDim = Math.max(this.frame_.height, this.frame_.width);
            // Surface diameter is treated differently for unbounded vs. bounded ripples.
            // Unbounded ripple diameter is calculated smaller since the surface is expected to already be padded appropriately
            // to extend the hitbox, and the ripple is expected to meet the edges of the padded hitbox (which is typically
            // square). Bounded ripples, on the other hand, are fully expected to expand beyond the surface's longest diameter
            // (calculated based on the diagonal plus a constant padding), and are clipped at the surface's border via
            // `overflow: hidden`.
            var getBoundedRadius = function () {
                var hypotenuse = Math.sqrt(Math.pow(_this.frame_.width, 2) + Math.pow(_this.frame_.height, 2));
                return hypotenuse + MDCRippleFoundation.numbers.PADDING;
            };
            this.maxRadius_ = this.adapter_.isUnbounded() ? maxDim : getBoundedRadius();
            // Ripple is sized as a fraction of the largest dimension of the surface, then scales up using a CSS scale transform
            this.initialSize_ = Math.floor(maxDim * MDCRippleFoundation.numbers.INITIAL_ORIGIN_SCALE);
            this.fgScale_ = "" + this.maxRadius_ / this.initialSize_;
            this.updateLayoutCssVars_();
        };
        MDCRippleFoundation.prototype.updateLayoutCssVars_ = function () {
            var _a = MDCRippleFoundation.strings, VAR_FG_SIZE = _a.VAR_FG_SIZE, VAR_LEFT = _a.VAR_LEFT, VAR_TOP = _a.VAR_TOP, VAR_FG_SCALE = _a.VAR_FG_SCALE;
            this.adapter_.updateCssVariable(VAR_FG_SIZE, this.initialSize_ + "px");
            this.adapter_.updateCssVariable(VAR_FG_SCALE, this.fgScale_);
            if (this.adapter_.isUnbounded()) {
                this.unboundedCoords_ = {
                    left: Math.round((this.frame_.width / 2) - (this.initialSize_ / 2)),
                    top: Math.round((this.frame_.height / 2) - (this.initialSize_ / 2)),
                };
                this.adapter_.updateCssVariable(VAR_LEFT, this.unboundedCoords_.left + "px");
                this.adapter_.updateCssVariable(VAR_TOP, this.unboundedCoords_.top + "px");
            }
        };
        return MDCRippleFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCRipple = /** @class */ (function (_super) {
        __extends(MDCRipple, _super);
        function MDCRipple() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.disabled = false;
            return _this;
        }
        MDCRipple.attachTo = function (root, opts) {
            if (opts === void 0) { opts = { isUnbounded: undefined }; }
            var ripple = new MDCRipple(root);
            // Only override unbounded behavior if option is explicitly specified
            if (opts.isUnbounded !== undefined) {
                ripple.unbounded = opts.isUnbounded;
            }
            return ripple;
        };
        MDCRipple.createAdapter = function (instance) {
            return {
                addClass: function (className) { return instance.root_.classList.add(className); },
                browserSupportsCssVars: function () { return supportsCssVariables(window); },
                computeBoundingRect: function () { return instance.root_.getBoundingClientRect(); },
                containsEventTarget: function (target) { return instance.root_.contains(target); },
                deregisterDocumentInteractionHandler: function (evtType, handler) {
                    return document.documentElement.removeEventListener(evtType, handler, applyPassive());
                },
                deregisterInteractionHandler: function (evtType, handler) {
                    return instance.root_.removeEventListener(evtType, handler, applyPassive());
                },
                deregisterResizeHandler: function (handler) { return window.removeEventListener('resize', handler); },
                getWindowPageOffset: function () { return ({ x: window.pageXOffset, y: window.pageYOffset }); },
                isSurfaceActive: function () { return matches(instance.root_, ':active'); },
                isSurfaceDisabled: function () { return Boolean(instance.disabled); },
                isUnbounded: function () { return Boolean(instance.unbounded); },
                registerDocumentInteractionHandler: function (evtType, handler) {
                    return document.documentElement.addEventListener(evtType, handler, applyPassive());
                },
                registerInteractionHandler: function (evtType, handler) {
                    return instance.root_.addEventListener(evtType, handler, applyPassive());
                },
                registerResizeHandler: function (handler) { return window.addEventListener('resize', handler); },
                removeClass: function (className) { return instance.root_.classList.remove(className); },
                updateCssVariable: function (varName, value) { return instance.root_.style.setProperty(varName, value); },
            };
        };
        Object.defineProperty(MDCRipple.prototype, "unbounded", {
            get: function () {
                return Boolean(this.unbounded_);
            },
            set: function (unbounded) {
                this.unbounded_ = Boolean(unbounded);
                this.setUnbounded_();
            },
            enumerable: true,
            configurable: true
        });
        MDCRipple.prototype.activate = function () {
            this.foundation_.activate();
        };
        MDCRipple.prototype.deactivate = function () {
            this.foundation_.deactivate();
        };
        MDCRipple.prototype.layout = function () {
            this.foundation_.layout();
        };
        MDCRipple.prototype.getDefaultFoundation = function () {
            return new MDCRippleFoundation(MDCRipple.createAdapter(this));
        };
        MDCRipple.prototype.initialSyncWithDOM = function () {
            var root = this.root_;
            this.unbounded = 'mdcRippleIsUnbounded' in root.dataset;
        };
        /**
         * Closure Compiler throws an access control error when directly accessing a
         * protected or private property inside a getter/setter, like unbounded above.
         * By accessing the protected property inside a method, we solve that problem.
         * That's why this function exists.
         */
        MDCRipple.prototype.setUnbounded_ = function () {
            this.foundation_.setUnbounded(Boolean(this.unbounded_));
        };
        return MDCRipple;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    function Ripple(node, [ripple, props = {unbounded: false, color: null}]) {
      let instance = null;
      let addLayoutListener = getContext('SMUI:addLayoutListener');
      let removeLayoutListener;

      function handleProps(ripple, props) {
        if (ripple && !instance) {
          instance = new MDCRipple(node);
        } else if (instance && !ripple) {
          instance.destroy();
          instance = null;
        }
        if (ripple) {
          instance.unbounded = !!props.unbounded;
          switch (props.color) {
            case 'surface':
              node.classList.add('mdc-ripple-surface');
              node.classList.remove('mdc-ripple-surface--primary');
              node.classList.remove('mdc-ripple-surface--accent');
              return;
            case 'primary':
              node.classList.add('mdc-ripple-surface');
              node.classList.add('mdc-ripple-surface--primary');
              node.classList.remove('mdc-ripple-surface--accent');
              return;
            case 'secondary':
              node.classList.add('mdc-ripple-surface');
              node.classList.remove('mdc-ripple-surface--primary');
              node.classList.add('mdc-ripple-surface--accent');
              return;
          }
        }
        node.classList.remove('mdc-ripple-surface');
        node.classList.remove('mdc-ripple-surface--primary');
        node.classList.remove('mdc-ripple-surface--accent');
      }

      if (ripple) {
        handleProps(ripple, props);
      }

      if (addLayoutListener) {
        removeLayoutListener = addLayoutListener(layout);
      }

      function layout() {
        if (instance) {
          instance.layout();
        }
      }

      return {
        update([ripple, props = {unbounded: false, color: null}]) {
          handleProps(ripple, props);
        },

        destroy() {
          if (instance) {
            instance.destroy();
            instance = null;
            node.classList.remove('mdc-ripple-surface');
            node.classList.remove('mdc-ripple-surface--primary');
            node.classList.remove('mdc-ripple-surface--accent');
          }

          if (removeLayoutListener) {
            removeLayoutListener();
          }
        }
      }
    }

    /* node_modules/@smui/button/Button.svelte generated by Svelte v3.16.0 */
    const file$2 = "node_modules/@smui/button/Button.svelte";

    // (23:0) {:else}
    function create_else_block$1(ctx) {
    	let button;
    	let useActions_action;
    	let forwardEvents_action;
    	let Ripple_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[17].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);

    	let button_levels = [
    		{
    			class: "mdc-button " + /*className*/ ctx[1]
    		},
    		/*actionProp*/ ctx[8],
    		/*defaultProp*/ ctx[9],
    		/*props*/ ctx[7]
    	];

    	let button_data = {};

    	for (let i = 0; i < button_levels.length; i += 1) {
    		button_data = assign(button_data, button_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			set_attributes(button, button_data);
    			toggle_class(button, "mdc-card__action--button", /*context*/ ctx[11] === "card:action");
    			toggle_class(button, "mdc-button--raised", /*variant*/ ctx[4] === "raised");
    			toggle_class(button, "mdc-button--unelevated", /*variant*/ ctx[4] === "unelevated");
    			toggle_class(button, "mdc-button--outlined", /*variant*/ ctx[4] === "outlined");
    			toggle_class(button, "mdc-button--dense", /*dense*/ ctx[5]);
    			toggle_class(button, "smui-button--color-secondary", /*color*/ ctx[3] === "secondary");
    			toggle_class(button, "mdc-card__action", /*context*/ ctx[11] === "card:action");
    			toggle_class(button, "mdc-dialog__button", /*context*/ ctx[11] === "dialog:action");
    			toggle_class(button, "mdc-top-app-bar__navigation-icon", /*context*/ ctx[11] === "top-app-bar:navigation");
    			toggle_class(button, "mdc-top-app-bar__action-item", /*context*/ ctx[11] === "top-app-bar:action");
    			toggle_class(button, "mdc-snackbar__action", /*context*/ ctx[11] === "snackbar");
    			add_location(button, file$2, 23, 2, 898);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			useActions_action = useActions.call(null, button, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[10].call(null, button) || ({});
    			Ripple_action = Ripple.call(null, button, [/*ripple*/ ctx[2], { unbounded: false }]) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 65536) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[16], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[16], dirty, null));
    			}

    			set_attributes(button, get_spread_update(button_levels, [
    				dirty & /*className*/ 2 && ({
    					class: "mdc-button " + /*className*/ ctx[1]
    				}),
    				dirty & /*actionProp*/ 256 && /*actionProp*/ ctx[8],
    				dirty & /*defaultProp*/ 512 && /*defaultProp*/ ctx[9],
    				dirty & /*props*/ 128 && /*props*/ ctx[7]
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			if (is_function(Ripple_action.update) && dirty & /*ripple*/ 4) Ripple_action.update.call(null, [/*ripple*/ ctx[2], { unbounded: false }]);
    			toggle_class(button, "mdc-card__action--button", /*context*/ ctx[11] === "card:action");
    			toggle_class(button, "mdc-button--raised", /*variant*/ ctx[4] === "raised");
    			toggle_class(button, "mdc-button--unelevated", /*variant*/ ctx[4] === "unelevated");
    			toggle_class(button, "mdc-button--outlined", /*variant*/ ctx[4] === "outlined");
    			toggle_class(button, "mdc-button--dense", /*dense*/ ctx[5]);
    			toggle_class(button, "smui-button--color-secondary", /*color*/ ctx[3] === "secondary");
    			toggle_class(button, "mdc-card__action", /*context*/ ctx[11] === "card:action");
    			toggle_class(button, "mdc-dialog__button", /*context*/ ctx[11] === "dialog:action");
    			toggle_class(button, "mdc-top-app-bar__navigation-icon", /*context*/ ctx[11] === "top-app-bar:navigation");
    			toggle_class(button, "mdc-top-app-bar__action-item", /*context*/ ctx[11] === "top-app-bar:action");
    			toggle_class(button, "mdc-snackbar__action", /*context*/ ctx[11] === "snackbar");
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (Ripple_action && is_function(Ripple_action.destroy)) Ripple_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(23:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (1:0) {#if href}
    function create_if_block$1(ctx) {
    	let a;
    	let useActions_action;
    	let forwardEvents_action;
    	let Ripple_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[17].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);

    	let a_levels = [
    		{
    			class: "mdc-button " + /*className*/ ctx[1]
    		},
    		{ href: /*href*/ ctx[6] },
    		/*actionProp*/ ctx[8],
    		/*defaultProp*/ ctx[9],
    		/*props*/ ctx[7]
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			set_attributes(a, a_data);
    			toggle_class(a, "mdc-card__action--button", /*context*/ ctx[11] === "card:action");
    			toggle_class(a, "mdc-button--raised", /*variant*/ ctx[4] === "raised");
    			toggle_class(a, "mdc-button--unelevated", /*variant*/ ctx[4] === "unelevated");
    			toggle_class(a, "mdc-button--outlined", /*variant*/ ctx[4] === "outlined");
    			toggle_class(a, "mdc-button--dense", /*dense*/ ctx[5]);
    			toggle_class(a, "smui-button--color-secondary", /*color*/ ctx[3] === "secondary");
    			toggle_class(a, "mdc-card__action", /*context*/ ctx[11] === "card:action");
    			toggle_class(a, "mdc-dialog__button", /*context*/ ctx[11] === "dialog:action");
    			toggle_class(a, "mdc-top-app-bar__navigation-icon", /*context*/ ctx[11] === "top-app-bar:navigation");
    			toggle_class(a, "mdc-top-app-bar__action-item", /*context*/ ctx[11] === "top-app-bar:action");
    			toggle_class(a, "mdc-snackbar__action", /*context*/ ctx[11] === "snackbar");
    			add_location(a, file$2, 1, 2, 13);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			useActions_action = useActions.call(null, a, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[10].call(null, a) || ({});
    			Ripple_action = Ripple.call(null, a, [/*ripple*/ ctx[2], { unbounded: false }]) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 65536) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[16], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[16], dirty, null));
    			}

    			set_attributes(a, get_spread_update(a_levels, [
    				dirty & /*className*/ 2 && ({
    					class: "mdc-button " + /*className*/ ctx[1]
    				}),
    				dirty & /*href*/ 64 && ({ href: /*href*/ ctx[6] }),
    				dirty & /*actionProp*/ 256 && /*actionProp*/ ctx[8],
    				dirty & /*defaultProp*/ 512 && /*defaultProp*/ ctx[9],
    				dirty & /*props*/ 128 && /*props*/ ctx[7]
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			if (is_function(Ripple_action.update) && dirty & /*ripple*/ 4) Ripple_action.update.call(null, [/*ripple*/ ctx[2], { unbounded: false }]);
    			toggle_class(a, "mdc-card__action--button", /*context*/ ctx[11] === "card:action");
    			toggle_class(a, "mdc-button--raised", /*variant*/ ctx[4] === "raised");
    			toggle_class(a, "mdc-button--unelevated", /*variant*/ ctx[4] === "unelevated");
    			toggle_class(a, "mdc-button--outlined", /*variant*/ ctx[4] === "outlined");
    			toggle_class(a, "mdc-button--dense", /*dense*/ ctx[5]);
    			toggle_class(a, "smui-button--color-secondary", /*color*/ ctx[3] === "secondary");
    			toggle_class(a, "mdc-card__action", /*context*/ ctx[11] === "card:action");
    			toggle_class(a, "mdc-dialog__button", /*context*/ ctx[11] === "dialog:action");
    			toggle_class(a, "mdc-top-app-bar__navigation-icon", /*context*/ ctx[11] === "top-app-bar:navigation");
    			toggle_class(a, "mdc-top-app-bar__action-item", /*context*/ ctx[11] === "top-app-bar:action");
    			toggle_class(a, "mdc-snackbar__action", /*context*/ ctx[11] === "snackbar");
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (Ripple_action && is_function(Ripple_action.destroy)) Ripple_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(1:0) {#if href}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*href*/ ctx[6]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { ripple = true } = $$props;
    	let { color = "primary" } = $$props;
    	let { variant = "text" } = $$props;
    	let { dense = false } = $$props;
    	let { href = null } = $$props;
    	let { action = "close" } = $$props;
    	let { default: defaultAction = false } = $$props;
    	let context = getContext("SMUI:button:context");
    	setContext("SMUI:label:context", "button");
    	setContext("SMUI:icon:context", "button");
    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(15, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("ripple" in $$new_props) $$invalidate(2, ripple = $$new_props.ripple);
    		if ("color" in $$new_props) $$invalidate(3, color = $$new_props.color);
    		if ("variant" in $$new_props) $$invalidate(4, variant = $$new_props.variant);
    		if ("dense" in $$new_props) $$invalidate(5, dense = $$new_props.dense);
    		if ("href" in $$new_props) $$invalidate(6, href = $$new_props.href);
    		if ("action" in $$new_props) $$invalidate(12, action = $$new_props.action);
    		if ("default" in $$new_props) $$invalidate(13, defaultAction = $$new_props.default);
    		if ("$$scope" in $$new_props) $$invalidate(16, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			ripple,
    			color,
    			variant,
    			dense,
    			href,
    			action,
    			defaultAction,
    			context,
    			dialogExcludes,
    			props,
    			actionProp,
    			defaultProp
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(15, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("ripple" in $$props) $$invalidate(2, ripple = $$new_props.ripple);
    		if ("color" in $$props) $$invalidate(3, color = $$new_props.color);
    		if ("variant" in $$props) $$invalidate(4, variant = $$new_props.variant);
    		if ("dense" in $$props) $$invalidate(5, dense = $$new_props.dense);
    		if ("href" in $$props) $$invalidate(6, href = $$new_props.href);
    		if ("action" in $$props) $$invalidate(12, action = $$new_props.action);
    		if ("defaultAction" in $$props) $$invalidate(13, defaultAction = $$new_props.defaultAction);
    		if ("context" in $$props) $$invalidate(11, context = $$new_props.context);
    		if ("dialogExcludes" in $$props) $$invalidate(14, dialogExcludes = $$new_props.dialogExcludes);
    		if ("props" in $$props) $$invalidate(7, props = $$new_props.props);
    		if ("actionProp" in $$props) $$invalidate(8, actionProp = $$new_props.actionProp);
    		if ("defaultProp" in $$props) $$invalidate(9, defaultProp = $$new_props.defaultProp);
    	};

    	let dialogExcludes;
    	let props;
    	let actionProp;
    	let defaultProp;

    	$$self.$$.update = () => {
    		 $$invalidate(7, props = exclude($$props, [
    			"use",
    			"class",
    			"ripple",
    			"color",
    			"variant",
    			"dense",
    			"href",
    			...dialogExcludes
    		]));

    		if ($$self.$$.dirty & /*action*/ 4096) {
    			 $$invalidate(8, actionProp = context === "dialog:action" && action !== null
    			? { "data-mdc-dialog-action": action }
    			: {});
    		}

    		if ($$self.$$.dirty & /*defaultAction*/ 8192) {
    			 $$invalidate(9, defaultProp = context === "dialog:action" && defaultAction
    			? { "data-mdc-dialog-button-default": "" }
    			: {});
    		}
    	};

    	 $$invalidate(14, dialogExcludes = context === "dialog:action" ? ["action", "default"] : []);
    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		ripple,
    		color,
    		variant,
    		dense,
    		href,
    		props,
    		actionProp,
    		defaultProp,
    		forwardEvents,
    		context,
    		action,
    		defaultAction,
    		dialogExcludes,
    		$$props,
    		$$scope,
    		$$slots
    	];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			use: 0,
    			class: 1,
    			ripple: 2,
    			color: 3,
    			variant: 4,
    			dense: 5,
    			href: 6,
    			action: 12,
    			default: 13
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get use() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ripple() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ripple(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get variant() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variant(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dense() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dense(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get href() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set href(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get action() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set action(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get default() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set default(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/common/Label.svelte generated by Svelte v3.16.0 */
    const file$3 = "node_modules/@smui/common/Label.svelte";

    function create_fragment$5(ctx) {
    	let span;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	let span_levels = [
    		{ class: /*className*/ ctx[1] },
    		/*snackbarProps*/ ctx[2],
    		exclude(/*$$props*/ ctx[5], ["use", "class"])
    	];

    	let span_data = {};

    	for (let i = 0; i < span_levels.length; i += 1) {
    		span_data = assign(span_data, span_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			span = element("span");
    			if (default_slot) default_slot.c();
    			set_attributes(span, span_data);
    			toggle_class(span, "mdc-chip__text", /*context*/ ctx[4] === "chip");
    			toggle_class(span, "mdc-button__label", /*context*/ ctx[4] === "button");
    			toggle_class(span, "mdc-fab__label", /*context*/ ctx[4] === "fab");
    			toggle_class(span, "mdc-tab__text-label", /*context*/ ctx[4] === "tab");
    			toggle_class(span, "mdc-image-list__label", /*context*/ ctx[4] === "image-list");
    			toggle_class(span, "mdc-snackbar__label", /*context*/ ctx[4] === "snackbar");
    			add_location(span, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);

    			if (default_slot) {
    				default_slot.m(span, null);
    			}

    			useActions_action = useActions.call(null, span, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[3].call(null, span) || ({});
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 64) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[6], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null));
    			}

    			set_attributes(span, get_spread_update(span_levels, [
    				dirty & /*className*/ 2 && ({ class: /*className*/ ctx[1] }),
    				dirty & /*snackbarProps*/ 4 && /*snackbarProps*/ ctx[2],
    				dirty & /*exclude, $$props*/ 32 && exclude(/*$$props*/ ctx[5], ["use", "class"])
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			toggle_class(span, "mdc-chip__text", /*context*/ ctx[4] === "chip");
    			toggle_class(span, "mdc-button__label", /*context*/ ctx[4] === "button");
    			toggle_class(span, "mdc-fab__label", /*context*/ ctx[4] === "fab");
    			toggle_class(span, "mdc-tab__text-label", /*context*/ ctx[4] === "tab");
    			toggle_class(span, "mdc-image-list__label", /*context*/ ctx[4] === "image-list");
    			toggle_class(span, "mdc-snackbar__label", /*context*/ ctx[4] === "snackbar");
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (default_slot) default_slot.d(detaching);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	const context = getContext("SMUI:label:context");
    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("$$scope" in $$new_props) $$invalidate(6, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return { use, className, snackbarProps };
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("snackbarProps" in $$props) $$invalidate(2, snackbarProps = $$new_props.snackbarProps);
    	};

    	let snackbarProps;

    	 $$invalidate(2, snackbarProps = context === "snackbar"
    	? { role: "status", "aria-live": "polite" }
    	: {});

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		snackbarProps,
    		forwardEvents,
    		context,
    		$$props,
    		$$scope,
    		$$slots
    	];
    }

    class Label extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { use: 0, class: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Label",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get use() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Label>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Label>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$1 = {
        LABEL_FLOAT_ABOVE: 'mdc-floating-label--float-above',
        LABEL_SHAKE: 'mdc-floating-label--shake',
        ROOT: 'mdc-floating-label',
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFloatingLabelFoundation = /** @class */ (function (_super) {
        __extends(MDCFloatingLabelFoundation, _super);
        function MDCFloatingLabelFoundation(adapter) {
            var _this = _super.call(this, __assign({}, MDCFloatingLabelFoundation.defaultAdapter, adapter)) || this;
            _this.shakeAnimationEndHandler_ = function () { return _this.handleShakeAnimationEnd_(); };
            return _this;
        }
        Object.defineProperty(MDCFloatingLabelFoundation, "cssClasses", {
            get: function () {
                return cssClasses$1;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCFloatingLabelFoundation, "defaultAdapter", {
            /**
             * See {@link MDCFloatingLabelAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    getWidth: function () { return 0; },
                    registerInteractionHandler: function () { return undefined; },
                    deregisterInteractionHandler: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        MDCFloatingLabelFoundation.prototype.init = function () {
            this.adapter_.registerInteractionHandler('animationend', this.shakeAnimationEndHandler_);
        };
        MDCFloatingLabelFoundation.prototype.destroy = function () {
            this.adapter_.deregisterInteractionHandler('animationend', this.shakeAnimationEndHandler_);
        };
        /**
         * Returns the width of the label element.
         */
        MDCFloatingLabelFoundation.prototype.getWidth = function () {
            return this.adapter_.getWidth();
        };
        /**
         * Styles the label to produce a shake animation to indicate an error.
         * @param shouldShake If true, adds the shake CSS class; otherwise, removes shake class.
         */
        MDCFloatingLabelFoundation.prototype.shake = function (shouldShake) {
            var LABEL_SHAKE = MDCFloatingLabelFoundation.cssClasses.LABEL_SHAKE;
            if (shouldShake) {
                this.adapter_.addClass(LABEL_SHAKE);
            }
            else {
                this.adapter_.removeClass(LABEL_SHAKE);
            }
        };
        /**
         * Styles the label to float or dock.
         * @param shouldFloat If true, adds the float CSS class; otherwise, removes float and shake classes to dock the label.
         */
        MDCFloatingLabelFoundation.prototype.float = function (shouldFloat) {
            var _a = MDCFloatingLabelFoundation.cssClasses, LABEL_FLOAT_ABOVE = _a.LABEL_FLOAT_ABOVE, LABEL_SHAKE = _a.LABEL_SHAKE;
            if (shouldFloat) {
                this.adapter_.addClass(LABEL_FLOAT_ABOVE);
            }
            else {
                this.adapter_.removeClass(LABEL_FLOAT_ABOVE);
                this.adapter_.removeClass(LABEL_SHAKE);
            }
        };
        MDCFloatingLabelFoundation.prototype.handleShakeAnimationEnd_ = function () {
            var LABEL_SHAKE = MDCFloatingLabelFoundation.cssClasses.LABEL_SHAKE;
            this.adapter_.removeClass(LABEL_SHAKE);
        };
        return MDCFloatingLabelFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFloatingLabel = /** @class */ (function (_super) {
        __extends(MDCFloatingLabel, _super);
        function MDCFloatingLabel() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCFloatingLabel.attachTo = function (root) {
            return new MDCFloatingLabel(root);
        };
        /**
         * Styles the label to produce the label shake for errors.
         * @param shouldShake If true, shakes the label by adding a CSS class; otherwise, stops shaking by removing the class.
         */
        MDCFloatingLabel.prototype.shake = function (shouldShake) {
            this.foundation_.shake(shouldShake);
        };
        /**
         * Styles the label to float/dock.
         * @param shouldFloat If true, floats the label by adding a CSS class; otherwise, docks it by removing the class.
         */
        MDCFloatingLabel.prototype.float = function (shouldFloat) {
            this.foundation_.float(shouldFloat);
        };
        MDCFloatingLabel.prototype.getWidth = function () {
            return this.foundation_.getWidth();
        };
        MDCFloatingLabel.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = {
                addClass: function (className) { return _this.root_.classList.add(className); },
                removeClass: function (className) { return _this.root_.classList.remove(className); },
                getWidth: function () { return _this.root_.scrollWidth; },
                registerInteractionHandler: function (evtType, handler) { return _this.listen(evtType, handler); },
                deregisterInteractionHandler: function (evtType, handler) { return _this.unlisten(evtType, handler); },
            };
            // tslint:enable:object-literal-sort-keys
            return new MDCFloatingLabelFoundation(adapter);
        };
        return MDCFloatingLabel;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$2 = {
        LINE_RIPPLE_ACTIVE: 'mdc-line-ripple--active',
        LINE_RIPPLE_DEACTIVATING: 'mdc-line-ripple--deactivating',
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCLineRippleFoundation = /** @class */ (function (_super) {
        __extends(MDCLineRippleFoundation, _super);
        function MDCLineRippleFoundation(adapter) {
            var _this = _super.call(this, __assign({}, MDCLineRippleFoundation.defaultAdapter, adapter)) || this;
            _this.transitionEndHandler_ = function (evt) { return _this.handleTransitionEnd(evt); };
            return _this;
        }
        Object.defineProperty(MDCLineRippleFoundation, "cssClasses", {
            get: function () {
                return cssClasses$2;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCLineRippleFoundation, "defaultAdapter", {
            /**
             * See {@link MDCLineRippleAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    hasClass: function () { return false; },
                    setStyle: function () { return undefined; },
                    registerEventHandler: function () { return undefined; },
                    deregisterEventHandler: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        MDCLineRippleFoundation.prototype.init = function () {
            this.adapter_.registerEventHandler('transitionend', this.transitionEndHandler_);
        };
        MDCLineRippleFoundation.prototype.destroy = function () {
            this.adapter_.deregisterEventHandler('transitionend', this.transitionEndHandler_);
        };
        MDCLineRippleFoundation.prototype.activate = function () {
            this.adapter_.removeClass(cssClasses$2.LINE_RIPPLE_DEACTIVATING);
            this.adapter_.addClass(cssClasses$2.LINE_RIPPLE_ACTIVE);
        };
        MDCLineRippleFoundation.prototype.setRippleCenter = function (xCoordinate) {
            this.adapter_.setStyle('transform-origin', xCoordinate + "px center");
        };
        MDCLineRippleFoundation.prototype.deactivate = function () {
            this.adapter_.addClass(cssClasses$2.LINE_RIPPLE_DEACTIVATING);
        };
        MDCLineRippleFoundation.prototype.handleTransitionEnd = function (evt) {
            // Wait for the line ripple to be either transparent or opaque
            // before emitting the animation end event
            var isDeactivating = this.adapter_.hasClass(cssClasses$2.LINE_RIPPLE_DEACTIVATING);
            if (evt.propertyName === 'opacity') {
                if (isDeactivating) {
                    this.adapter_.removeClass(cssClasses$2.LINE_RIPPLE_ACTIVE);
                    this.adapter_.removeClass(cssClasses$2.LINE_RIPPLE_DEACTIVATING);
                }
            }
        };
        return MDCLineRippleFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCLineRipple = /** @class */ (function (_super) {
        __extends(MDCLineRipple, _super);
        function MDCLineRipple() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCLineRipple.attachTo = function (root) {
            return new MDCLineRipple(root);
        };
        /**
         * Activates the line ripple
         */
        MDCLineRipple.prototype.activate = function () {
            this.foundation_.activate();
        };
        /**
         * Deactivates the line ripple
         */
        MDCLineRipple.prototype.deactivate = function () {
            this.foundation_.deactivate();
        };
        /**
         * Sets the transform origin given a user's click location.
         * The `rippleCenter` is the x-coordinate of the middle of the ripple.
         */
        MDCLineRipple.prototype.setRippleCenter = function (xCoordinate) {
            this.foundation_.setRippleCenter(xCoordinate);
        };
        MDCLineRipple.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = {
                addClass: function (className) { return _this.root_.classList.add(className); },
                removeClass: function (className) { return _this.root_.classList.remove(className); },
                hasClass: function (className) { return _this.root_.classList.contains(className); },
                setStyle: function (propertyName, value) { return _this.root_.style.setProperty(propertyName, value); },
                registerEventHandler: function (evtType, handler) { return _this.listen(evtType, handler); },
                deregisterEventHandler: function (evtType, handler) { return _this.unlisten(evtType, handler); },
            };
            // tslint:enable:object-literal-sort-keys
            return new MDCLineRippleFoundation(adapter);
        };
        return MDCLineRipple;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$3 = {
        ANCHOR: 'mdc-menu-surface--anchor',
        ANIMATING_CLOSED: 'mdc-menu-surface--animating-closed',
        ANIMATING_OPEN: 'mdc-menu-surface--animating-open',
        FIXED: 'mdc-menu-surface--fixed',
        OPEN: 'mdc-menu-surface--open',
        ROOT: 'mdc-menu-surface',
    };
    // tslint:disable:object-literal-sort-keys
    var strings$1 = {
        CLOSED_EVENT: 'MDCMenuSurface:closed',
        OPENED_EVENT: 'MDCMenuSurface:opened',
        FOCUSABLE_ELEMENTS: [
            'button:not(:disabled)', '[href]:not([aria-disabled="true"])', 'input:not(:disabled)',
            'select:not(:disabled)', 'textarea:not(:disabled)', '[tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])',
        ].join(', '),
    };
    // tslint:enable:object-literal-sort-keys
    var numbers$1 = {
        /** Total duration of menu-surface open animation. */
        TRANSITION_OPEN_DURATION: 120,
        /** Total duration of menu-surface close animation. */
        TRANSITION_CLOSE_DURATION: 75,
        /** Margin left to the edge of the viewport when menu-surface is at maximum possible height. */
        MARGIN_TO_EDGE: 32,
        /** Ratio of anchor width to menu-surface width for switching from corner positioning to center positioning. */
        ANCHOR_TO_MENU_SURFACE_WIDTH_RATIO: 0.67,
    };
    /**
     * Enum for bits in the {@see Corner) bitmap.
     */
    var CornerBit;
    (function (CornerBit) {
        CornerBit[CornerBit["BOTTOM"] = 1] = "BOTTOM";
        CornerBit[CornerBit["CENTER"] = 2] = "CENTER";
        CornerBit[CornerBit["RIGHT"] = 4] = "RIGHT";
        CornerBit[CornerBit["FLIP_RTL"] = 8] = "FLIP_RTL";
    })(CornerBit || (CornerBit = {}));
    /**
     * Enum for representing an element corner for positioning the menu-surface.
     *
     * The START constants map to LEFT if element directionality is left
     * to right and RIGHT if the directionality is right to left.
     * Likewise END maps to RIGHT or LEFT depending on the directionality.
     */
    var Corner;
    (function (Corner) {
        Corner[Corner["TOP_LEFT"] = 0] = "TOP_LEFT";
        Corner[Corner["TOP_RIGHT"] = 4] = "TOP_RIGHT";
        Corner[Corner["BOTTOM_LEFT"] = 1] = "BOTTOM_LEFT";
        Corner[Corner["BOTTOM_RIGHT"] = 5] = "BOTTOM_RIGHT";
        Corner[Corner["TOP_START"] = 8] = "TOP_START";
        Corner[Corner["TOP_END"] = 12] = "TOP_END";
        Corner[Corner["BOTTOM_START"] = 9] = "BOTTOM_START";
        Corner[Corner["BOTTOM_END"] = 13] = "BOTTOM_END";
    })(Corner || (Corner = {}));
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$4 = {
        LIST_ITEM_ACTIVATED_CLASS: 'mdc-list-item--activated',
        LIST_ITEM_CLASS: 'mdc-list-item',
        LIST_ITEM_DISABLED_CLASS: 'mdc-list-item--disabled',
        LIST_ITEM_SELECTED_CLASS: 'mdc-list-item--selected',
        ROOT: 'mdc-list',
    };
    var strings$2 = {
        ACTION_EVENT: 'MDCList:action',
        ARIA_CHECKED: 'aria-checked',
        ARIA_CHECKED_CHECKBOX_SELECTOR: '[role="checkbox"][aria-checked="true"]',
        ARIA_CHECKED_RADIO_SELECTOR: '[role="radio"][aria-checked="true"]',
        ARIA_CURRENT: 'aria-current',
        ARIA_DISABLED: 'aria-disabled',
        ARIA_ORIENTATION: 'aria-orientation',
        ARIA_ORIENTATION_HORIZONTAL: 'horizontal',
        ARIA_ROLE_CHECKBOX_SELECTOR: '[role="checkbox"]',
        ARIA_SELECTED: 'aria-selected',
        CHECKBOX_RADIO_SELECTOR: 'input[type="checkbox"]:not(:disabled), input[type="radio"]:not(:disabled)',
        CHECKBOX_SELECTOR: 'input[type="checkbox"]:not(:disabled)',
        CHILD_ELEMENTS_TO_TOGGLE_TABINDEX: "\n    ." + cssClasses$4.LIST_ITEM_CLASS + " button:not(:disabled),\n    ." + cssClasses$4.LIST_ITEM_CLASS + " a\n  ",
        FOCUSABLE_CHILD_ELEMENTS: "\n    ." + cssClasses$4.LIST_ITEM_CLASS + " button:not(:disabled),\n    ." + cssClasses$4.LIST_ITEM_CLASS + " a,\n    ." + cssClasses$4.LIST_ITEM_CLASS + " input[type=\"radio\"]:not(:disabled),\n    ." + cssClasses$4.LIST_ITEM_CLASS + " input[type=\"checkbox\"]:not(:disabled)\n  ",
        RADIO_SELECTOR: 'input[type="radio"]:not(:disabled)',
    };
    var numbers$2 = {
        UNSET_INDEX: -1,
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var ELEMENTS_KEY_ALLOWED_IN = ['input', 'button', 'textarea', 'select'];
    function isNumberArray(selectedIndex) {
        return selectedIndex instanceof Array;
    }
    var MDCListFoundation = /** @class */ (function (_super) {
        __extends(MDCListFoundation, _super);
        function MDCListFoundation(adapter) {
            var _this = _super.call(this, __assign({}, MDCListFoundation.defaultAdapter, adapter)) || this;
            _this.wrapFocus_ = false;
            _this.isVertical_ = true;
            _this.isSingleSelectionList_ = false;
            _this.selectedIndex_ = numbers$2.UNSET_INDEX;
            _this.focusedItemIndex_ = numbers$2.UNSET_INDEX;
            _this.useActivatedClass_ = false;
            _this.ariaCurrentAttrValue_ = null;
            _this.isCheckboxList_ = false;
            _this.isRadioList_ = false;
            return _this;
        }
        Object.defineProperty(MDCListFoundation, "strings", {
            get: function () {
                return strings$2;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCListFoundation, "cssClasses", {
            get: function () {
                return cssClasses$4;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCListFoundation, "numbers", {
            get: function () {
                return numbers$2;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCListFoundation, "defaultAdapter", {
            get: function () {
                return {
                    addClassForElementIndex: function () { return undefined; },
                    focusItemAtIndex: function () { return undefined; },
                    getAttributeForElementIndex: function () { return null; },
                    getFocusedElementIndex: function () { return 0; },
                    getListItemCount: function () { return 0; },
                    hasCheckboxAtIndex: function () { return false; },
                    hasRadioAtIndex: function () { return false; },
                    isCheckboxCheckedAtIndex: function () { return false; },
                    isFocusInsideList: function () { return false; },
                    isRootFocused: function () { return false; },
                    notifyAction: function () { return undefined; },
                    removeClassForElementIndex: function () { return undefined; },
                    setAttributeForElementIndex: function () { return undefined; },
                    setCheckedCheckboxOrRadioAtIndex: function () { return undefined; },
                    setTabIndexForListItemChildren: function () { return undefined; },
                };
            },
            enumerable: true,
            configurable: true
        });
        MDCListFoundation.prototype.layout = function () {
            if (this.adapter_.getListItemCount() === 0) {
                return;
            }
            if (this.adapter_.hasCheckboxAtIndex(0)) {
                this.isCheckboxList_ = true;
            }
            else if (this.adapter_.hasRadioAtIndex(0)) {
                this.isRadioList_ = true;
            }
        };
        /**
         * Sets the private wrapFocus_ variable.
         */
        MDCListFoundation.prototype.setWrapFocus = function (value) {
            this.wrapFocus_ = value;
        };
        /**
         * Sets the isVertical_ private variable.
         */
        MDCListFoundation.prototype.setVerticalOrientation = function (value) {
            this.isVertical_ = value;
        };
        /**
         * Sets the isSingleSelectionList_ private variable.
         */
        MDCListFoundation.prototype.setSingleSelection = function (value) {
            this.isSingleSelectionList_ = value;
        };
        /**
         * Sets the useActivatedClass_ private variable.
         */
        MDCListFoundation.prototype.setUseActivatedClass = function (useActivated) {
            this.useActivatedClass_ = useActivated;
        };
        MDCListFoundation.prototype.getSelectedIndex = function () {
            return this.selectedIndex_;
        };
        MDCListFoundation.prototype.setSelectedIndex = function (index) {
            if (!this.isIndexValid_(index)) {
                return;
            }
            if (this.isCheckboxList_) {
                this.setCheckboxAtIndex_(index);
            }
            else if (this.isRadioList_) {
                this.setRadioAtIndex_(index);
            }
            else {
                this.setSingleSelectionAtIndex_(index);
            }
        };
        /**
         * Focus in handler for the list items.
         */
        MDCListFoundation.prototype.handleFocusIn = function (_, listItemIndex) {
            if (listItemIndex >= 0) {
                this.adapter_.setTabIndexForListItemChildren(listItemIndex, '0');
            }
        };
        /**
         * Focus out handler for the list items.
         */
        MDCListFoundation.prototype.handleFocusOut = function (_, listItemIndex) {
            var _this = this;
            if (listItemIndex >= 0) {
                this.adapter_.setTabIndexForListItemChildren(listItemIndex, '-1');
            }
            /**
             * Between Focusout & Focusin some browsers do not have focus on any element. Setting a delay to wait till the focus
             * is moved to next element.
             */
            setTimeout(function () {
                if (!_this.adapter_.isFocusInsideList()) {
                    _this.setTabindexToFirstSelectedItem_();
                }
            }, 0);
        };
        /**
         * Key handler for the list.
         */
        MDCListFoundation.prototype.handleKeydown = function (evt, isRootListItem, listItemIndex) {
            var isArrowLeft = evt.key === 'ArrowLeft' || evt.keyCode === 37;
            var isArrowUp = evt.key === 'ArrowUp' || evt.keyCode === 38;
            var isArrowRight = evt.key === 'ArrowRight' || evt.keyCode === 39;
            var isArrowDown = evt.key === 'ArrowDown' || evt.keyCode === 40;
            var isHome = evt.key === 'Home' || evt.keyCode === 36;
            var isEnd = evt.key === 'End' || evt.keyCode === 35;
            var isEnter = evt.key === 'Enter' || evt.keyCode === 13;
            var isSpace = evt.key === 'Space' || evt.keyCode === 32;
            if (this.adapter_.isRootFocused()) {
                if (isArrowUp || isEnd) {
                    evt.preventDefault();
                    this.focusLastElement();
                }
                else if (isArrowDown || isHome) {
                    evt.preventDefault();
                    this.focusFirstElement();
                }
                return;
            }
            var currentIndex = this.adapter_.getFocusedElementIndex();
            if (currentIndex === -1) {
                currentIndex = listItemIndex;
                if (currentIndex < 0) {
                    // If this event doesn't have a mdc-list-item ancestor from the
                    // current list (not from a sublist), return early.
                    return;
                }
            }
            var nextIndex;
            if ((this.isVertical_ && isArrowDown) || (!this.isVertical_ && isArrowRight)) {
                this.preventDefaultEvent_(evt);
                nextIndex = this.focusNextElement(currentIndex);
            }
            else if ((this.isVertical_ && isArrowUp) || (!this.isVertical_ && isArrowLeft)) {
                this.preventDefaultEvent_(evt);
                nextIndex = this.focusPrevElement(currentIndex);
            }
            else if (isHome) {
                this.preventDefaultEvent_(evt);
                nextIndex = this.focusFirstElement();
            }
            else if (isEnd) {
                this.preventDefaultEvent_(evt);
                nextIndex = this.focusLastElement();
            }
            else if (isEnter || isSpace) {
                if (isRootListItem) {
                    // Return early if enter key is pressed on anchor element which triggers synthetic MouseEvent event.
                    var target = evt.target;
                    if (target && target.tagName === 'A' && isEnter) {
                        return;
                    }
                    this.preventDefaultEvent_(evt);
                    if (this.isSelectableList_()) {
                        this.setSelectedIndexOnAction_(currentIndex);
                    }
                    this.adapter_.notifyAction(currentIndex);
                }
            }
            this.focusedItemIndex_ = currentIndex;
            if (nextIndex !== undefined) {
                this.setTabindexAtIndex_(nextIndex);
                this.focusedItemIndex_ = nextIndex;
            }
        };
        /**
         * Click handler for the list.
         */
        MDCListFoundation.prototype.handleClick = function (index, toggleCheckbox) {
            if (index === numbers$2.UNSET_INDEX) {
                return;
            }
            if (this.isSelectableList_()) {
                this.setSelectedIndexOnAction_(index, toggleCheckbox);
            }
            this.adapter_.notifyAction(index);
            this.setTabindexAtIndex_(index);
            this.focusedItemIndex_ = index;
        };
        /**
         * Focuses the next element on the list.
         */
        MDCListFoundation.prototype.focusNextElement = function (index) {
            var count = this.adapter_.getListItemCount();
            var nextIndex = index + 1;
            if (nextIndex >= count) {
                if (this.wrapFocus_) {
                    nextIndex = 0;
                }
                else {
                    // Return early because last item is already focused.
                    return index;
                }
            }
            this.adapter_.focusItemAtIndex(nextIndex);
            return nextIndex;
        };
        /**
         * Focuses the previous element on the list.
         */
        MDCListFoundation.prototype.focusPrevElement = function (index) {
            var prevIndex = index - 1;
            if (prevIndex < 0) {
                if (this.wrapFocus_) {
                    prevIndex = this.adapter_.getListItemCount() - 1;
                }
                else {
                    // Return early because first item is already focused.
                    return index;
                }
            }
            this.adapter_.focusItemAtIndex(prevIndex);
            return prevIndex;
        };
        MDCListFoundation.prototype.focusFirstElement = function () {
            this.adapter_.focusItemAtIndex(0);
            return 0;
        };
        MDCListFoundation.prototype.focusLastElement = function () {
            var lastIndex = this.adapter_.getListItemCount() - 1;
            this.adapter_.focusItemAtIndex(lastIndex);
            return lastIndex;
        };
        /**
         * @param itemIndex Index of the list item
         * @param isEnabled Sets the list item to enabled or disabled.
         */
        MDCListFoundation.prototype.setEnabled = function (itemIndex, isEnabled) {
            if (!this.isIndexValid_(itemIndex)) {
                return;
            }
            if (isEnabled) {
                this.adapter_.removeClassForElementIndex(itemIndex, cssClasses$4.LIST_ITEM_DISABLED_CLASS);
                this.adapter_.setAttributeForElementIndex(itemIndex, strings$2.ARIA_DISABLED, 'false');
            }
            else {
                this.adapter_.addClassForElementIndex(itemIndex, cssClasses$4.LIST_ITEM_DISABLED_CLASS);
                this.adapter_.setAttributeForElementIndex(itemIndex, strings$2.ARIA_DISABLED, 'true');
            }
        };
        /**
         * Ensures that preventDefault is only called if the containing element doesn't
         * consume the event, and it will cause an unintended scroll.
         */
        MDCListFoundation.prototype.preventDefaultEvent_ = function (evt) {
            var target = evt.target;
            var tagName = ("" + target.tagName).toLowerCase();
            if (ELEMENTS_KEY_ALLOWED_IN.indexOf(tagName) === -1) {
                evt.preventDefault();
            }
        };
        MDCListFoundation.prototype.setSingleSelectionAtIndex_ = function (index) {
            if (this.selectedIndex_ === index) {
                return;
            }
            var selectedClassName = cssClasses$4.LIST_ITEM_SELECTED_CLASS;
            if (this.useActivatedClass_) {
                selectedClassName = cssClasses$4.LIST_ITEM_ACTIVATED_CLASS;
            }
            if (this.selectedIndex_ !== numbers$2.UNSET_INDEX) {
                this.adapter_.removeClassForElementIndex(this.selectedIndex_, selectedClassName);
            }
            this.adapter_.addClassForElementIndex(index, selectedClassName);
            this.setAriaForSingleSelectionAtIndex_(index);
            this.selectedIndex_ = index;
        };
        /**
         * Sets aria attribute for single selection at given index.
         */
        MDCListFoundation.prototype.setAriaForSingleSelectionAtIndex_ = function (index) {
            // Detect the presence of aria-current and get the value only during list initialization when it is in unset state.
            if (this.selectedIndex_ === numbers$2.UNSET_INDEX) {
                this.ariaCurrentAttrValue_ =
                    this.adapter_.getAttributeForElementIndex(index, strings$2.ARIA_CURRENT);
            }
            var isAriaCurrent = this.ariaCurrentAttrValue_ !== null;
            var ariaAttribute = isAriaCurrent ? strings$2.ARIA_CURRENT : strings$2.ARIA_SELECTED;
            if (this.selectedIndex_ !== numbers$2.UNSET_INDEX) {
                this.adapter_.setAttributeForElementIndex(this.selectedIndex_, ariaAttribute, 'false');
            }
            var ariaAttributeValue = isAriaCurrent ? this.ariaCurrentAttrValue_ : 'true';
            this.adapter_.setAttributeForElementIndex(index, ariaAttribute, ariaAttributeValue);
        };
        /**
         * Toggles radio at give index. Radio doesn't change the checked state if it is already checked.
         */
        MDCListFoundation.prototype.setRadioAtIndex_ = function (index) {
            this.adapter_.setCheckedCheckboxOrRadioAtIndex(index, true);
            if (this.selectedIndex_ !== numbers$2.UNSET_INDEX) {
                this.adapter_.setAttributeForElementIndex(this.selectedIndex_, strings$2.ARIA_CHECKED, 'false');
            }
            this.adapter_.setAttributeForElementIndex(index, strings$2.ARIA_CHECKED, 'true');
            this.selectedIndex_ = index;
        };
        MDCListFoundation.prototype.setCheckboxAtIndex_ = function (index) {
            for (var i = 0; i < this.adapter_.getListItemCount(); i++) {
                var isChecked = false;
                if (index.indexOf(i) >= 0) {
                    isChecked = true;
                }
                this.adapter_.setCheckedCheckboxOrRadioAtIndex(i, isChecked);
                this.adapter_.setAttributeForElementIndex(i, strings$2.ARIA_CHECKED, isChecked ? 'true' : 'false');
            }
            this.selectedIndex_ = index;
        };
        MDCListFoundation.prototype.setTabindexAtIndex_ = function (index) {
            if (this.focusedItemIndex_ === numbers$2.UNSET_INDEX && index !== 0) {
                // If no list item was selected set first list item's tabindex to -1.
                // Generally, tabindex is set to 0 on first list item of list that has no preselected items.
                this.adapter_.setAttributeForElementIndex(0, 'tabindex', '-1');
            }
            else if (this.focusedItemIndex_ >= 0 && this.focusedItemIndex_ !== index) {
                this.adapter_.setAttributeForElementIndex(this.focusedItemIndex_, 'tabindex', '-1');
            }
            this.adapter_.setAttributeForElementIndex(index, 'tabindex', '0');
        };
        /**
         * @return Return true if it is single selectin list, checkbox list or radio list.
         */
        MDCListFoundation.prototype.isSelectableList_ = function () {
            return this.isSingleSelectionList_ || this.isCheckboxList_ || this.isRadioList_;
        };
        MDCListFoundation.prototype.setTabindexToFirstSelectedItem_ = function () {
            var targetIndex = 0;
            if (this.isSelectableList_()) {
                if (typeof this.selectedIndex_ === 'number' && this.selectedIndex_ !== numbers$2.UNSET_INDEX) {
                    targetIndex = this.selectedIndex_;
                }
                else if (isNumberArray(this.selectedIndex_) && this.selectedIndex_.length > 0) {
                    targetIndex = this.selectedIndex_.reduce(function (currentIndex, minIndex) { return Math.min(currentIndex, minIndex); });
                }
            }
            this.setTabindexAtIndex_(targetIndex);
        };
        MDCListFoundation.prototype.isIndexValid_ = function (index) {
            var _this = this;
            if (index instanceof Array) {
                if (!this.isCheckboxList_) {
                    throw new Error('MDCListFoundation: Array of index is only supported for checkbox based list');
                }
                if (index.length === 0) {
                    return true;
                }
                else {
                    return index.some(function (i) { return _this.isIndexInRange_(i); });
                }
            }
            else if (typeof index === 'number') {
                if (this.isCheckboxList_) {
                    throw new Error('MDCListFoundation: Expected array of index for checkbox based list but got number: ' + index);
                }
                return this.isIndexInRange_(index);
            }
            else {
                return false;
            }
        };
        MDCListFoundation.prototype.isIndexInRange_ = function (index) {
            var listSize = this.adapter_.getListItemCount();
            return index >= 0 && index < listSize;
        };
        MDCListFoundation.prototype.setSelectedIndexOnAction_ = function (index, toggleCheckbox) {
            if (toggleCheckbox === void 0) { toggleCheckbox = true; }
            if (this.isCheckboxList_) {
                this.toggleCheckboxAtIndex_(index, toggleCheckbox);
            }
            else {
                this.setSelectedIndex(index);
            }
        };
        MDCListFoundation.prototype.toggleCheckboxAtIndex_ = function (index, toggleCheckbox) {
            var isChecked = this.adapter_.isCheckboxCheckedAtIndex(index);
            if (toggleCheckbox) {
                isChecked = !isChecked;
                this.adapter_.setCheckedCheckboxOrRadioAtIndex(index, isChecked);
            }
            this.adapter_.setAttributeForElementIndex(index, strings$2.ARIA_CHECKED, isChecked ? 'true' : 'false');
            // If none of the checkbox items are selected and selectedIndex is not initialized then provide a default value.
            var selectedIndexes = this.selectedIndex_ === numbers$2.UNSET_INDEX ? [] : this.selectedIndex_.slice();
            if (isChecked) {
                selectedIndexes.push(index);
            }
            else {
                selectedIndexes = selectedIndexes.filter(function (i) { return i !== index; });
            }
            this.selectedIndex_ = selectedIndexes;
        };
        return MDCListFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCList = /** @class */ (function (_super) {
        __extends(MDCList, _super);
        function MDCList() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Object.defineProperty(MDCList.prototype, "vertical", {
            set: function (value) {
                this.foundation_.setVerticalOrientation(value);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCList.prototype, "listElements", {
            get: function () {
                return [].slice.call(this.root_.querySelectorAll("." + cssClasses$4.LIST_ITEM_CLASS));
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCList.prototype, "wrapFocus", {
            set: function (value) {
                this.foundation_.setWrapFocus(value);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCList.prototype, "singleSelection", {
            set: function (isSingleSelectionList) {
                this.foundation_.setSingleSelection(isSingleSelectionList);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCList.prototype, "selectedIndex", {
            get: function () {
                return this.foundation_.getSelectedIndex();
            },
            set: function (index) {
                this.foundation_.setSelectedIndex(index);
            },
            enumerable: true,
            configurable: true
        });
        MDCList.attachTo = function (root) {
            return new MDCList(root);
        };
        MDCList.prototype.initialSyncWithDOM = function () {
            this.handleClick_ = this.handleClickEvent_.bind(this);
            this.handleKeydown_ = this.handleKeydownEvent_.bind(this);
            this.focusInEventListener_ = this.handleFocusInEvent_.bind(this);
            this.focusOutEventListener_ = this.handleFocusOutEvent_.bind(this);
            this.listen('keydown', this.handleKeydown_);
            this.listen('click', this.handleClick_);
            this.listen('focusin', this.focusInEventListener_);
            this.listen('focusout', this.focusOutEventListener_);
            this.layout();
            this.initializeListType();
        };
        MDCList.prototype.destroy = function () {
            this.unlisten('keydown', this.handleKeydown_);
            this.unlisten('click', this.handleClick_);
            this.unlisten('focusin', this.focusInEventListener_);
            this.unlisten('focusout', this.focusOutEventListener_);
        };
        MDCList.prototype.layout = function () {
            var direction = this.root_.getAttribute(strings$2.ARIA_ORIENTATION);
            this.vertical = direction !== strings$2.ARIA_ORIENTATION_HORIZONTAL;
            // List items need to have at least tabindex=-1 to be focusable.
            [].slice.call(this.root_.querySelectorAll('.mdc-list-item:not([tabindex])'))
                .forEach(function (el) {
                el.setAttribute('tabindex', '-1');
            });
            // Child button/a elements are not tabbable until the list item is focused.
            [].slice.call(this.root_.querySelectorAll(strings$2.FOCUSABLE_CHILD_ELEMENTS))
                .forEach(function (el) { return el.setAttribute('tabindex', '-1'); });
            this.foundation_.layout();
        };
        /**
         * Initialize selectedIndex value based on pre-selected checkbox list items, single selection or radio.
         */
        MDCList.prototype.initializeListType = function () {
            var _this = this;
            var checkboxListItems = this.root_.querySelectorAll(strings$2.ARIA_ROLE_CHECKBOX_SELECTOR);
            var singleSelectedListItem = this.root_.querySelector("\n      ." + cssClasses$4.LIST_ITEM_ACTIVATED_CLASS + ",\n      ." + cssClasses$4.LIST_ITEM_SELECTED_CLASS + "\n    ");
            var radioSelectedListItem = this.root_.querySelector(strings$2.ARIA_CHECKED_RADIO_SELECTOR);
            if (checkboxListItems.length) {
                var preselectedItems = this.root_.querySelectorAll(strings$2.ARIA_CHECKED_CHECKBOX_SELECTOR);
                this.selectedIndex =
                    [].map.call(preselectedItems, function (listItem) { return _this.listElements.indexOf(listItem); });
            }
            else if (singleSelectedListItem) {
                if (singleSelectedListItem.classList.contains(cssClasses$4.LIST_ITEM_ACTIVATED_CLASS)) {
                    this.foundation_.setUseActivatedClass(true);
                }
                this.singleSelection = true;
                this.selectedIndex = this.listElements.indexOf(singleSelectedListItem);
            }
            else if (radioSelectedListItem) {
                this.selectedIndex = this.listElements.indexOf(radioSelectedListItem);
            }
        };
        /**
         * Updates the list item at itemIndex to the desired isEnabled state.
         * @param itemIndex Index of the list item
         * @param isEnabled Sets the list item to enabled or disabled.
         */
        MDCList.prototype.setEnabled = function (itemIndex, isEnabled) {
            this.foundation_.setEnabled(itemIndex, isEnabled);
        };
        MDCList.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            var adapter = {
                addClassForElementIndex: function (index, className) {
                    var element = _this.listElements[index];
                    if (element) {
                        element.classList.add(className);
                    }
                },
                focusItemAtIndex: function (index) {
                    var element = _this.listElements[index];
                    if (element) {
                        element.focus();
                    }
                },
                getAttributeForElementIndex: function (index, attr) { return _this.listElements[index].getAttribute(attr); },
                getFocusedElementIndex: function () { return _this.listElements.indexOf(document.activeElement); },
                getListItemCount: function () { return _this.listElements.length; },
                hasCheckboxAtIndex: function (index) {
                    var listItem = _this.listElements[index];
                    return !!listItem.querySelector(strings$2.CHECKBOX_SELECTOR);
                },
                hasRadioAtIndex: function (index) {
                    var listItem = _this.listElements[index];
                    return !!listItem.querySelector(strings$2.RADIO_SELECTOR);
                },
                isCheckboxCheckedAtIndex: function (index) {
                    var listItem = _this.listElements[index];
                    var toggleEl = listItem.querySelector(strings$2.CHECKBOX_SELECTOR);
                    return toggleEl.checked;
                },
                isFocusInsideList: function () {
                    return _this.root_.contains(document.activeElement);
                },
                isRootFocused: function () { return document.activeElement === _this.root_; },
                notifyAction: function (index) {
                    _this.emit(strings$2.ACTION_EVENT, { index: index }, /** shouldBubble */ true);
                },
                removeClassForElementIndex: function (index, className) {
                    var element = _this.listElements[index];
                    if (element) {
                        element.classList.remove(className);
                    }
                },
                setAttributeForElementIndex: function (index, attr, value) {
                    var element = _this.listElements[index];
                    if (element) {
                        element.setAttribute(attr, value);
                    }
                },
                setCheckedCheckboxOrRadioAtIndex: function (index, isChecked) {
                    var listItem = _this.listElements[index];
                    var toggleEl = listItem.querySelector(strings$2.CHECKBOX_RADIO_SELECTOR);
                    toggleEl.checked = isChecked;
                    var event = document.createEvent('Event');
                    event.initEvent('change', true, true);
                    toggleEl.dispatchEvent(event);
                },
                setTabIndexForListItemChildren: function (listItemIndex, tabIndexValue) {
                    var element = _this.listElements[listItemIndex];
                    var listItemChildren = [].slice.call(element.querySelectorAll(strings$2.CHILD_ELEMENTS_TO_TOGGLE_TABINDEX));
                    listItemChildren.forEach(function (el) { return el.setAttribute('tabindex', tabIndexValue); });
                },
            };
            return new MDCListFoundation(adapter);
        };
        /**
         * Used to figure out which list item this event is targetting. Or returns -1 if
         * there is no list item
         */
        MDCList.prototype.getListItemIndex_ = function (evt) {
            var eventTarget = evt.target;
            var nearestParent = closest(eventTarget, "." + cssClasses$4.LIST_ITEM_CLASS + ", ." + cssClasses$4.ROOT);
            // Get the index of the element if it is a list item.
            if (nearestParent && matches(nearestParent, "." + cssClasses$4.LIST_ITEM_CLASS)) {
                return this.listElements.indexOf(nearestParent);
            }
            return -1;
        };
        /**
         * Used to figure out which element was clicked before sending the event to the foundation.
         */
        MDCList.prototype.handleFocusInEvent_ = function (evt) {
            var index = this.getListItemIndex_(evt);
            this.foundation_.handleFocusIn(evt, index);
        };
        /**
         * Used to figure out which element was clicked before sending the event to the foundation.
         */
        MDCList.prototype.handleFocusOutEvent_ = function (evt) {
            var index = this.getListItemIndex_(evt);
            this.foundation_.handleFocusOut(evt, index);
        };
        /**
         * Used to figure out which element was focused when keydown event occurred before sending the event to the
         * foundation.
         */
        MDCList.prototype.handleKeydownEvent_ = function (evt) {
            var index = this.getListItemIndex_(evt);
            var target = evt.target;
            this.foundation_.handleKeydown(evt, target.classList.contains(cssClasses$4.LIST_ITEM_CLASS), index);
        };
        /**
         * Used to figure out which element was clicked before sending the event to the foundation.
         */
        MDCList.prototype.handleClickEvent_ = function (evt) {
            var index = this.getListItemIndex_(evt);
            var target = evt.target;
            // Toggle the checkbox only if it's not the target of the event, or the checkbox will have 2 change events.
            var toggleCheckbox = !matches(target, strings$2.CHECKBOX_RADIO_SELECTOR);
            this.foundation_.handleClick(index, toggleCheckbox);
        };
        return MDCList;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCMenuSurfaceFoundation = /** @class */ (function (_super) {
        __extends(MDCMenuSurfaceFoundation, _super);
        function MDCMenuSurfaceFoundation(adapter) {
            var _this = _super.call(this, __assign({}, MDCMenuSurfaceFoundation.defaultAdapter, adapter)) || this;
            _this.isOpen_ = false;
            _this.isQuickOpen_ = false;
            _this.isHoistedElement_ = false;
            _this.isFixedPosition_ = false;
            _this.openAnimationEndTimerId_ = 0;
            _this.closeAnimationEndTimerId_ = 0;
            _this.animationRequestId_ = 0;
            _this.anchorCorner_ = Corner.TOP_START;
            _this.anchorMargin_ = { top: 0, right: 0, bottom: 0, left: 0 };
            _this.position_ = { x: 0, y: 0 };
            return _this;
        }
        Object.defineProperty(MDCMenuSurfaceFoundation, "cssClasses", {
            get: function () {
                return cssClasses$3;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenuSurfaceFoundation, "strings", {
            get: function () {
                return strings$1;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenuSurfaceFoundation, "numbers", {
            get: function () {
                return numbers$1;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenuSurfaceFoundation, "Corner", {
            get: function () {
                return Corner;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenuSurfaceFoundation, "defaultAdapter", {
            /**
             * @see {@link MDCMenuSurfaceAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    hasClass: function () { return false; },
                    hasAnchor: function () { return false; },
                    isElementInContainer: function () { return false; },
                    isFocused: function () { return false; },
                    isRtl: function () { return false; },
                    getInnerDimensions: function () { return ({ height: 0, width: 0 }); },
                    getAnchorDimensions: function () { return null; },
                    getWindowDimensions: function () { return ({ height: 0, width: 0 }); },
                    getBodyDimensions: function () { return ({ height: 0, width: 0 }); },
                    getWindowScroll: function () { return ({ x: 0, y: 0 }); },
                    setPosition: function () { return undefined; },
                    setMaxHeight: function () { return undefined; },
                    setTransformOrigin: function () { return undefined; },
                    saveFocus: function () { return undefined; },
                    restoreFocus: function () { return undefined; },
                    notifyClose: function () { return undefined; },
                    notifyOpen: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        MDCMenuSurfaceFoundation.prototype.init = function () {
            var _a = MDCMenuSurfaceFoundation.cssClasses, ROOT = _a.ROOT, OPEN = _a.OPEN;
            if (!this.adapter_.hasClass(ROOT)) {
                throw new Error(ROOT + " class required in root element.");
            }
            if (this.adapter_.hasClass(OPEN)) {
                this.isOpen_ = true;
            }
        };
        MDCMenuSurfaceFoundation.prototype.destroy = function () {
            clearTimeout(this.openAnimationEndTimerId_);
            clearTimeout(this.closeAnimationEndTimerId_);
            // Cancel any currently running animations.
            cancelAnimationFrame(this.animationRequestId_);
        };
        /**
         * @param corner Default anchor corner alignment of top-left menu surface corner.
         */
        MDCMenuSurfaceFoundation.prototype.setAnchorCorner = function (corner) {
            this.anchorCorner_ = corner;
        };
        /**
         * @param margin Set of margin values from anchor.
         */
        MDCMenuSurfaceFoundation.prototype.setAnchorMargin = function (margin) {
            this.anchorMargin_.top = margin.top || 0;
            this.anchorMargin_.right = margin.right || 0;
            this.anchorMargin_.bottom = margin.bottom || 0;
            this.anchorMargin_.left = margin.left || 0;
        };
        /** Used to indicate if the menu-surface is hoisted to the body. */
        MDCMenuSurfaceFoundation.prototype.setIsHoisted = function (isHoisted) {
            this.isHoistedElement_ = isHoisted;
        };
        /** Used to set the menu-surface calculations based on a fixed position menu. */
        MDCMenuSurfaceFoundation.prototype.setFixedPosition = function (isFixedPosition) {
            this.isFixedPosition_ = isFixedPosition;
        };
        /** Sets the menu-surface position on the page. */
        MDCMenuSurfaceFoundation.prototype.setAbsolutePosition = function (x, y) {
            this.position_.x = this.isFinite_(x) ? x : 0;
            this.position_.y = this.isFinite_(y) ? y : 0;
        };
        MDCMenuSurfaceFoundation.prototype.setQuickOpen = function (quickOpen) {
            this.isQuickOpen_ = quickOpen;
        };
        MDCMenuSurfaceFoundation.prototype.isOpen = function () {
            return this.isOpen_;
        };
        /**
         * Open the menu surface.
         */
        MDCMenuSurfaceFoundation.prototype.open = function () {
            var _this = this;
            this.adapter_.saveFocus();
            if (!this.isQuickOpen_) {
                this.adapter_.addClass(MDCMenuSurfaceFoundation.cssClasses.ANIMATING_OPEN);
            }
            this.animationRequestId_ = requestAnimationFrame(function () {
                _this.adapter_.addClass(MDCMenuSurfaceFoundation.cssClasses.OPEN);
                _this.dimensions_ = _this.adapter_.getInnerDimensions();
                _this.autoPosition_();
                if (_this.isQuickOpen_) {
                    _this.adapter_.notifyOpen();
                }
                else {
                    _this.openAnimationEndTimerId_ = setTimeout(function () {
                        _this.openAnimationEndTimerId_ = 0;
                        _this.adapter_.removeClass(MDCMenuSurfaceFoundation.cssClasses.ANIMATING_OPEN);
                        _this.adapter_.notifyOpen();
                    }, numbers$1.TRANSITION_OPEN_DURATION);
                }
            });
            this.isOpen_ = true;
        };
        /**
         * Closes the menu surface.
         */
        MDCMenuSurfaceFoundation.prototype.close = function (skipRestoreFocus) {
            var _this = this;
            if (skipRestoreFocus === void 0) { skipRestoreFocus = false; }
            if (!this.isQuickOpen_) {
                this.adapter_.addClass(MDCMenuSurfaceFoundation.cssClasses.ANIMATING_CLOSED);
            }
            requestAnimationFrame(function () {
                _this.adapter_.removeClass(MDCMenuSurfaceFoundation.cssClasses.OPEN);
                if (_this.isQuickOpen_) {
                    _this.adapter_.notifyClose();
                }
                else {
                    _this.closeAnimationEndTimerId_ = setTimeout(function () {
                        _this.closeAnimationEndTimerId_ = 0;
                        _this.adapter_.removeClass(MDCMenuSurfaceFoundation.cssClasses.ANIMATING_CLOSED);
                        _this.adapter_.notifyClose();
                    }, numbers$1.TRANSITION_CLOSE_DURATION);
                }
            });
            this.isOpen_ = false;
            if (!skipRestoreFocus) {
                this.maybeRestoreFocus_();
            }
        };
        /** Handle clicks and close if not within menu-surface element. */
        MDCMenuSurfaceFoundation.prototype.handleBodyClick = function (evt) {
            var el = evt.target;
            if (this.adapter_.isElementInContainer(el)) {
                return;
            }
            this.close();
        };
        /** Handle keys that close the surface. */
        MDCMenuSurfaceFoundation.prototype.handleKeydown = function (evt) {
            var keyCode = evt.keyCode, key = evt.key;
            var isEscape = key === 'Escape' || keyCode === 27;
            if (isEscape) {
                this.close();
            }
        };
        MDCMenuSurfaceFoundation.prototype.autoPosition_ = function () {
            var _a;
            // Compute measurements for autoposition methods reuse.
            this.measurements_ = this.getAutoLayoutMeasurements_();
            var corner = this.getOriginCorner_();
            var maxMenuSurfaceHeight = this.getMenuSurfaceMaxHeight_(corner);
            var verticalAlignment = this.hasBit_(corner, CornerBit.BOTTOM) ? 'bottom' : 'top';
            var horizontalAlignment = this.hasBit_(corner, CornerBit.RIGHT) ? 'right' : 'left';
            var horizontalOffset = this.getHorizontalOriginOffset_(corner);
            var verticalOffset = this.getVerticalOriginOffset_(corner);
            var _b = this.measurements_, anchorSize = _b.anchorSize, surfaceSize = _b.surfaceSize;
            var position = (_a = {},
                _a[horizontalAlignment] = horizontalOffset,
                _a[verticalAlignment] = verticalOffset,
                _a);
            // Center align when anchor width is comparable or greater than menu surface, otherwise keep corner.
            if (anchorSize.width / surfaceSize.width > numbers$1.ANCHOR_TO_MENU_SURFACE_WIDTH_RATIO) {
                horizontalAlignment = 'center';
            }
            // If the menu-surface has been hoisted to the body, it's no longer relative to the anchor element
            if (this.isHoistedElement_ || this.isFixedPosition_) {
                this.adjustPositionForHoistedElement_(position);
            }
            this.adapter_.setTransformOrigin(horizontalAlignment + " " + verticalAlignment);
            this.adapter_.setPosition(position);
            this.adapter_.setMaxHeight(maxMenuSurfaceHeight ? maxMenuSurfaceHeight + 'px' : '');
        };
        /**
         * @return Measurements used to position menu surface popup.
         */
        MDCMenuSurfaceFoundation.prototype.getAutoLayoutMeasurements_ = function () {
            var anchorRect = this.adapter_.getAnchorDimensions();
            var bodySize = this.adapter_.getBodyDimensions();
            var viewportSize = this.adapter_.getWindowDimensions();
            var windowScroll = this.adapter_.getWindowScroll();
            if (!anchorRect) {
                // tslint:disable:object-literal-sort-keys Positional properties are more readable when they're grouped together
                anchorRect = {
                    top: this.position_.y,
                    right: this.position_.x,
                    bottom: this.position_.y,
                    left: this.position_.x,
                    width: 0,
                    height: 0,
                };
                // tslint:enable:object-literal-sort-keys
            }
            return {
                anchorSize: anchorRect,
                bodySize: bodySize,
                surfaceSize: this.dimensions_,
                viewportDistance: {
                    // tslint:disable:object-literal-sort-keys Positional properties are more readable when they're grouped together
                    top: anchorRect.top,
                    right: viewportSize.width - anchorRect.right,
                    bottom: viewportSize.height - anchorRect.bottom,
                    left: anchorRect.left,
                },
                viewportSize: viewportSize,
                windowScroll: windowScroll,
            };
        };
        /**
         * Computes the corner of the anchor from which to animate and position the menu surface.
         */
        MDCMenuSurfaceFoundation.prototype.getOriginCorner_ = function () {
            // Defaults: open from the top left.
            var corner = Corner.TOP_LEFT;
            var _a = this.measurements_, viewportDistance = _a.viewportDistance, anchorSize = _a.anchorSize, surfaceSize = _a.surfaceSize;
            var isBottomAligned = this.hasBit_(this.anchorCorner_, CornerBit.BOTTOM);
            var availableTop = isBottomAligned ? viewportDistance.top + anchorSize.height + this.anchorMargin_.bottom
                : viewportDistance.top + this.anchorMargin_.top;
            var availableBottom = isBottomAligned ? viewportDistance.bottom - this.anchorMargin_.bottom
                : viewportDistance.bottom + anchorSize.height - this.anchorMargin_.top;
            var topOverflow = surfaceSize.height - availableTop;
            var bottomOverflow = surfaceSize.height - availableBottom;
            if (bottomOverflow > 0 && topOverflow < bottomOverflow) {
                corner = this.setBit_(corner, CornerBit.BOTTOM);
            }
            var isRtl = this.adapter_.isRtl();
            var isFlipRtl = this.hasBit_(this.anchorCorner_, CornerBit.FLIP_RTL);
            var avoidHorizontalOverlap = this.hasBit_(this.anchorCorner_, CornerBit.RIGHT);
            var isAlignedRight = (avoidHorizontalOverlap && !isRtl) ||
                (!avoidHorizontalOverlap && isFlipRtl && isRtl);
            var availableLeft = isAlignedRight ? viewportDistance.left + anchorSize.width + this.anchorMargin_.right :
                viewportDistance.left + this.anchorMargin_.left;
            var availableRight = isAlignedRight ? viewportDistance.right - this.anchorMargin_.right :
                viewportDistance.right + anchorSize.width - this.anchorMargin_.left;
            var leftOverflow = surfaceSize.width - availableLeft;
            var rightOverflow = surfaceSize.width - availableRight;
            if ((leftOverflow < 0 && isAlignedRight && isRtl) ||
                (avoidHorizontalOverlap && !isAlignedRight && leftOverflow < 0) ||
                (rightOverflow > 0 && leftOverflow < rightOverflow)) {
                corner = this.setBit_(corner, CornerBit.RIGHT);
            }
            return corner;
        };
        /**
         * @param corner Origin corner of the menu surface.
         * @return Maximum height of the menu surface, based on available space. 0 indicates should not be set.
         */
        MDCMenuSurfaceFoundation.prototype.getMenuSurfaceMaxHeight_ = function (corner) {
            var viewportDistance = this.measurements_.viewportDistance;
            var maxHeight = 0;
            var isBottomAligned = this.hasBit_(corner, CornerBit.BOTTOM);
            var isBottomAnchored = this.hasBit_(this.anchorCorner_, CornerBit.BOTTOM);
            var MARGIN_TO_EDGE = MDCMenuSurfaceFoundation.numbers.MARGIN_TO_EDGE;
            // When maximum height is not specified, it is handled from CSS.
            if (isBottomAligned) {
                maxHeight = viewportDistance.top + this.anchorMargin_.top - MARGIN_TO_EDGE;
                if (!isBottomAnchored) {
                    maxHeight += this.measurements_.anchorSize.height;
                }
            }
            else {
                maxHeight =
                    viewportDistance.bottom - this.anchorMargin_.bottom + this.measurements_.anchorSize.height - MARGIN_TO_EDGE;
                if (isBottomAnchored) {
                    maxHeight -= this.measurements_.anchorSize.height;
                }
            }
            return maxHeight;
        };
        /**
         * @param corner Origin corner of the menu surface.
         * @return Horizontal offset of menu surface origin corner from corresponding anchor corner.
         */
        MDCMenuSurfaceFoundation.prototype.getHorizontalOriginOffset_ = function (corner) {
            var anchorSize = this.measurements_.anchorSize;
            // isRightAligned corresponds to using the 'right' property on the surface.
            var isRightAligned = this.hasBit_(corner, CornerBit.RIGHT);
            var avoidHorizontalOverlap = this.hasBit_(this.anchorCorner_, CornerBit.RIGHT);
            if (isRightAligned) {
                var rightOffset = avoidHorizontalOverlap ? anchorSize.width - this.anchorMargin_.left : this.anchorMargin_.right;
                // For hoisted or fixed elements, adjust the offset by the difference between viewport width and body width so
                // when we calculate the right value (`adjustPositionForHoistedElement_`) based on the element position,
                // the right property is correct.
                if (this.isHoistedElement_ || this.isFixedPosition_) {
                    return rightOffset - (this.measurements_.viewportSize.width - this.measurements_.bodySize.width);
                }
                return rightOffset;
            }
            return avoidHorizontalOverlap ? anchorSize.width - this.anchorMargin_.right : this.anchorMargin_.left;
        };
        /**
         * @param corner Origin corner of the menu surface.
         * @return Vertical offset of menu surface origin corner from corresponding anchor corner.
         */
        MDCMenuSurfaceFoundation.prototype.getVerticalOriginOffset_ = function (corner) {
            var anchorSize = this.measurements_.anchorSize;
            var isBottomAligned = this.hasBit_(corner, CornerBit.BOTTOM);
            var avoidVerticalOverlap = this.hasBit_(this.anchorCorner_, CornerBit.BOTTOM);
            var y = 0;
            if (isBottomAligned) {
                y = avoidVerticalOverlap ? anchorSize.height - this.anchorMargin_.top : -this.anchorMargin_.bottom;
            }
            else {
                y = avoidVerticalOverlap ? (anchorSize.height + this.anchorMargin_.bottom) : this.anchorMargin_.top;
            }
            return y;
        };
        /** Calculates the offsets for positioning the menu-surface when the menu-surface has been hoisted to the body. */
        MDCMenuSurfaceFoundation.prototype.adjustPositionForHoistedElement_ = function (position) {
            var e_1, _a;
            var _b = this.measurements_, windowScroll = _b.windowScroll, viewportDistance = _b.viewportDistance;
            var props = Object.keys(position);
            try {
                for (var props_1 = __values(props), props_1_1 = props_1.next(); !props_1_1.done; props_1_1 = props_1.next()) {
                    var prop = props_1_1.value;
                    var value = position[prop] || 0;
                    // Hoisted surfaces need to have the anchor elements location on the page added to the
                    // position properties for proper alignment on the body.
                    value += viewportDistance[prop];
                    // Surfaces that are absolutely positioned need to have additional calculations for scroll
                    // and bottom positioning.
                    if (!this.isFixedPosition_) {
                        if (prop === 'top') {
                            value += windowScroll.y;
                        }
                        else if (prop === 'bottom') {
                            value -= windowScroll.y;
                        }
                        else if (prop === 'left') {
                            value += windowScroll.x;
                        }
                        else { // prop === 'right'
                            value -= windowScroll.x;
                        }
                    }
                    position[prop] = value;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (props_1_1 && !props_1_1.done && (_a = props_1.return)) _a.call(props_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        /**
         * The last focused element when the menu surface was opened should regain focus, if the user is
         * focused on or within the menu surface when it is closed.
         */
        MDCMenuSurfaceFoundation.prototype.maybeRestoreFocus_ = function () {
            var isRootFocused = this.adapter_.isFocused();
            var childHasFocus = document.activeElement && this.adapter_.isElementInContainer(document.activeElement);
            if (isRootFocused || childHasFocus) {
                this.adapter_.restoreFocus();
            }
        };
        MDCMenuSurfaceFoundation.prototype.hasBit_ = function (corner, bit) {
            return Boolean(corner & bit); // tslint:disable-line:no-bitwise
        };
        MDCMenuSurfaceFoundation.prototype.setBit_ = function (corner, bit) {
            return corner | bit; // tslint:disable-line:no-bitwise
        };
        /**
         * isFinite that doesn't force conversion to number type.
         * Equivalent to Number.isFinite in ES2015, which is not supported in IE.
         */
        MDCMenuSurfaceFoundation.prototype.isFinite_ = function (num) {
            return typeof num === 'number' && isFinite(num);
        };
        return MDCMenuSurfaceFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cachedCssTransformPropertyName_;
    /**
     * Returns the name of the correct transform property to use on the current browser.
     */
    function getTransformPropertyName(globalObj, forceRefresh) {
        if (forceRefresh === void 0) { forceRefresh = false; }
        if (cachedCssTransformPropertyName_ === undefined || forceRefresh) {
            var el = globalObj.document.createElement('div');
            cachedCssTransformPropertyName_ = 'transform' in el.style ? 'transform' : 'webkitTransform';
        }
        return cachedCssTransformPropertyName_;
    }
    //# sourceMappingURL=util.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCMenuSurface = /** @class */ (function (_super) {
        __extends(MDCMenuSurface, _super);
        function MDCMenuSurface() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCMenuSurface.attachTo = function (root) {
            return new MDCMenuSurface(root);
        };
        MDCMenuSurface.prototype.initialSyncWithDOM = function () {
            var _this = this;
            var parentEl = this.root_.parentElement;
            this.anchorElement = parentEl && parentEl.classList.contains(cssClasses$3.ANCHOR) ? parentEl : null;
            if (this.root_.classList.contains(cssClasses$3.FIXED)) {
                this.setFixedPosition(true);
            }
            this.handleKeydown_ = function (evt) { return _this.foundation_.handleKeydown(evt); };
            this.handleBodyClick_ = function (evt) { return _this.foundation_.handleBodyClick(evt); };
            this.registerBodyClickListener_ = function () { return document.body.addEventListener('click', _this.handleBodyClick_); };
            this.deregisterBodyClickListener_ = function () { return document.body.removeEventListener('click', _this.handleBodyClick_); };
            this.listen('keydown', this.handleKeydown_);
            this.listen(strings$1.OPENED_EVENT, this.registerBodyClickListener_);
            this.listen(strings$1.CLOSED_EVENT, this.deregisterBodyClickListener_);
        };
        MDCMenuSurface.prototype.destroy = function () {
            this.unlisten('keydown', this.handleKeydown_);
            this.unlisten(strings$1.OPENED_EVENT, this.registerBodyClickListener_);
            this.unlisten(strings$1.CLOSED_EVENT, this.deregisterBodyClickListener_);
            _super.prototype.destroy.call(this);
        };
        MDCMenuSurface.prototype.isOpen = function () {
            return this.foundation_.isOpen();
        };
        MDCMenuSurface.prototype.open = function () {
            this.foundation_.open();
        };
        MDCMenuSurface.prototype.close = function (skipRestoreFocus) {
            if (skipRestoreFocus === void 0) { skipRestoreFocus = false; }
            this.foundation_.close(skipRestoreFocus);
        };
        Object.defineProperty(MDCMenuSurface.prototype, "quickOpen", {
            set: function (quickOpen) {
                this.foundation_.setQuickOpen(quickOpen);
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Removes the menu-surface from it's current location and appends it to the
         * body to overcome any overflow:hidden issues.
         */
        MDCMenuSurface.prototype.hoistMenuToBody = function () {
            document.body.appendChild(this.root_);
            this.setIsHoisted(true);
        };
        /** Sets the foundation to use page offsets for an positioning when the menu is hoisted to the body. */
        MDCMenuSurface.prototype.setIsHoisted = function (isHoisted) {
            this.foundation_.setIsHoisted(isHoisted);
        };
        /** Sets the element that the menu-surface is anchored to. */
        MDCMenuSurface.prototype.setMenuSurfaceAnchorElement = function (element) {
            this.anchorElement = element;
        };
        /** Sets the menu-surface to position: fixed. */
        MDCMenuSurface.prototype.setFixedPosition = function (isFixed) {
            if (isFixed) {
                this.root_.classList.add(cssClasses$3.FIXED);
            }
            else {
                this.root_.classList.remove(cssClasses$3.FIXED);
            }
            this.foundation_.setFixedPosition(isFixed);
        };
        /** Sets the absolute x/y position to position based on. Requires the menu to be hoisted. */
        MDCMenuSurface.prototype.setAbsolutePosition = function (x, y) {
            this.foundation_.setAbsolutePosition(x, y);
            this.setIsHoisted(true);
        };
        /**
         * @param corner Default anchor corner alignment of top-left surface corner.
         */
        MDCMenuSurface.prototype.setAnchorCorner = function (corner) {
            this.foundation_.setAnchorCorner(corner);
        };
        MDCMenuSurface.prototype.setAnchorMargin = function (margin) {
            this.foundation_.setAnchorMargin(margin);
        };
        MDCMenuSurface.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = {
                addClass: function (className) { return _this.root_.classList.add(className); },
                removeClass: function (className) { return _this.root_.classList.remove(className); },
                hasClass: function (className) { return _this.root_.classList.contains(className); },
                hasAnchor: function () { return !!_this.anchorElement; },
                notifyClose: function () { return _this.emit(MDCMenuSurfaceFoundation.strings.CLOSED_EVENT, {}); },
                notifyOpen: function () { return _this.emit(MDCMenuSurfaceFoundation.strings.OPENED_EVENT, {}); },
                isElementInContainer: function (el) { return _this.root_.contains(el); },
                isRtl: function () { return getComputedStyle(_this.root_).getPropertyValue('direction') === 'rtl'; },
                setTransformOrigin: function (origin) {
                    var propertyName = getTransformPropertyName(window) + "-origin";
                    _this.root_.style.setProperty(propertyName, origin);
                },
                isFocused: function () { return document.activeElement === _this.root_; },
                saveFocus: function () {
                    _this.previousFocus_ = document.activeElement;
                },
                restoreFocus: function () {
                    if (_this.root_.contains(document.activeElement)) {
                        if (_this.previousFocus_ && _this.previousFocus_.focus) {
                            _this.previousFocus_.focus();
                        }
                    }
                },
                getInnerDimensions: function () {
                    return { width: _this.root_.offsetWidth, height: _this.root_.offsetHeight };
                },
                getAnchorDimensions: function () { return _this.anchorElement ? _this.anchorElement.getBoundingClientRect() : null; },
                getWindowDimensions: function () {
                    return { width: window.innerWidth, height: window.innerHeight };
                },
                getBodyDimensions: function () {
                    return { width: document.body.clientWidth, height: document.body.clientHeight };
                },
                getWindowScroll: function () {
                    return { x: window.pageXOffset, y: window.pageYOffset };
                },
                setPosition: function (position) {
                    _this.root_.style.left = 'left' in position ? position.left + "px" : '';
                    _this.root_.style.right = 'right' in position ? position.right + "px" : '';
                    _this.root_.style.top = 'top' in position ? position.top + "px" : '';
                    _this.root_.style.bottom = 'bottom' in position ? position.bottom + "px" : '';
                },
                setMaxHeight: function (height) {
                    _this.root_.style.maxHeight = height;
                },
            };
            // tslint:enable:object-literal-sort-keys
            return new MDCMenuSurfaceFoundation(adapter);
        };
        return MDCMenuSurface;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$5 = {
        MENU_SELECTED_LIST_ITEM: 'mdc-menu-item--selected',
        MENU_SELECTION_GROUP: 'mdc-menu__selection-group',
        ROOT: 'mdc-menu',
    };
    var strings$3 = {
        ARIA_CHECKED_ATTR: 'aria-checked',
        ARIA_DISABLED_ATTR: 'aria-disabled',
        CHECKBOX_SELECTOR: 'input[type="checkbox"]',
        LIST_SELECTOR: '.mdc-list',
        SELECTED_EVENT: 'MDCMenu:selected',
    };
    var numbers$3 = {
        FOCUS_ROOT_INDEX: -1,
    };
    var DefaultFocusState;
    (function (DefaultFocusState) {
        DefaultFocusState[DefaultFocusState["NONE"] = 0] = "NONE";
        DefaultFocusState[DefaultFocusState["LIST_ROOT"] = 1] = "LIST_ROOT";
        DefaultFocusState[DefaultFocusState["FIRST_ITEM"] = 2] = "FIRST_ITEM";
        DefaultFocusState[DefaultFocusState["LAST_ITEM"] = 3] = "LAST_ITEM";
    })(DefaultFocusState || (DefaultFocusState = {}));
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCMenuFoundation = /** @class */ (function (_super) {
        __extends(MDCMenuFoundation, _super);
        function MDCMenuFoundation(adapter) {
            var _this = _super.call(this, __assign({}, MDCMenuFoundation.defaultAdapter, adapter)) || this;
            _this.closeAnimationEndTimerId_ = 0;
            _this.defaultFocusState_ = DefaultFocusState.LIST_ROOT;
            return _this;
        }
        Object.defineProperty(MDCMenuFoundation, "cssClasses", {
            get: function () {
                return cssClasses$5;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenuFoundation, "strings", {
            get: function () {
                return strings$3;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenuFoundation, "numbers", {
            get: function () {
                return numbers$3;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenuFoundation, "defaultAdapter", {
            /**
             * @see {@link MDCMenuAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClassToElementAtIndex: function () { return undefined; },
                    removeClassFromElementAtIndex: function () { return undefined; },
                    addAttributeToElementAtIndex: function () { return undefined; },
                    removeAttributeFromElementAtIndex: function () { return undefined; },
                    elementContainsClass: function () { return false; },
                    closeSurface: function () { return undefined; },
                    getElementIndex: function () { return -1; },
                    notifySelected: function () { return undefined; },
                    getMenuItemCount: function () { return 0; },
                    focusItemAtIndex: function () { return undefined; },
                    focusListRoot: function () { return undefined; },
                    getSelectedSiblingOfItemAtIndex: function () { return -1; },
                    isSelectableItemAtIndex: function () { return false; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        MDCMenuFoundation.prototype.destroy = function () {
            if (this.closeAnimationEndTimerId_) {
                clearTimeout(this.closeAnimationEndTimerId_);
            }
            this.adapter_.closeSurface();
        };
        MDCMenuFoundation.prototype.handleKeydown = function (evt) {
            var key = evt.key, keyCode = evt.keyCode;
            var isTab = key === 'Tab' || keyCode === 9;
            if (isTab) {
                this.adapter_.closeSurface(/** skipRestoreFocus */ true);
            }
        };
        MDCMenuFoundation.prototype.handleItemAction = function (listItem) {
            var _this = this;
            var index = this.adapter_.getElementIndex(listItem);
            if (index < 0) {
                return;
            }
            this.adapter_.notifySelected({ index: index });
            this.adapter_.closeSurface();
            // Wait for the menu to close before adding/removing classes that affect styles.
            this.closeAnimationEndTimerId_ = setTimeout(function () {
                // Recompute the index in case the menu contents have changed.
                var recomputedIndex = _this.adapter_.getElementIndex(listItem);
                if (_this.adapter_.isSelectableItemAtIndex(recomputedIndex)) {
                    _this.setSelectedIndex(recomputedIndex);
                }
            }, MDCMenuSurfaceFoundation.numbers.TRANSITION_CLOSE_DURATION);
        };
        MDCMenuFoundation.prototype.handleMenuSurfaceOpened = function () {
            switch (this.defaultFocusState_) {
                case DefaultFocusState.FIRST_ITEM:
                    this.adapter_.focusItemAtIndex(0);
                    break;
                case DefaultFocusState.LAST_ITEM:
                    this.adapter_.focusItemAtIndex(this.adapter_.getMenuItemCount() - 1);
                    break;
                case DefaultFocusState.NONE:
                    // Do nothing.
                    break;
                default:
                    this.adapter_.focusListRoot();
                    break;
            }
        };
        /**
         * Sets default focus state where the menu should focus every time when menu
         * is opened. Focuses the list root (`DefaultFocusState.LIST_ROOT`) element by
         * default.
         */
        MDCMenuFoundation.prototype.setDefaultFocusState = function (focusState) {
            this.defaultFocusState_ = focusState;
        };
        /**
         * Selects the list item at `index` within the menu.
         * @param index Index of list item within the menu.
         */
        MDCMenuFoundation.prototype.setSelectedIndex = function (index) {
            this.validatedIndex_(index);
            if (!this.adapter_.isSelectableItemAtIndex(index)) {
                throw new Error('MDCMenuFoundation: No selection group at specified index.');
            }
            var prevSelectedIndex = this.adapter_.getSelectedSiblingOfItemAtIndex(index);
            if (prevSelectedIndex >= 0) {
                this.adapter_.removeAttributeFromElementAtIndex(prevSelectedIndex, strings$3.ARIA_CHECKED_ATTR);
                this.adapter_.removeClassFromElementAtIndex(prevSelectedIndex, cssClasses$5.MENU_SELECTED_LIST_ITEM);
            }
            this.adapter_.addClassToElementAtIndex(index, cssClasses$5.MENU_SELECTED_LIST_ITEM);
            this.adapter_.addAttributeToElementAtIndex(index, strings$3.ARIA_CHECKED_ATTR, 'true');
        };
        /**
         * Sets the enabled state to isEnabled for the menu item at the given index.
         * @param index Index of the menu item
         * @param isEnabled The desired enabled state of the menu item.
         */
        MDCMenuFoundation.prototype.setEnabled = function (index, isEnabled) {
            this.validatedIndex_(index);
            if (isEnabled) {
                this.adapter_.removeClassFromElementAtIndex(index, cssClasses$4.LIST_ITEM_DISABLED_CLASS);
                this.adapter_.addAttributeToElementAtIndex(index, strings$3.ARIA_DISABLED_ATTR, 'false');
            }
            else {
                this.adapter_.addClassToElementAtIndex(index, cssClasses$4.LIST_ITEM_DISABLED_CLASS);
                this.adapter_.addAttributeToElementAtIndex(index, strings$3.ARIA_DISABLED_ATTR, 'true');
            }
        };
        MDCMenuFoundation.prototype.validatedIndex_ = function (index) {
            var menuSize = this.adapter_.getMenuItemCount();
            var isIndexInRange = index >= 0 && index < menuSize;
            if (!isIndexInRange) {
                throw new Error('MDCMenuFoundation: No list item at specified index.');
            }
        };
        return MDCMenuFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCMenu = /** @class */ (function (_super) {
        __extends(MDCMenu, _super);
        function MDCMenu() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCMenu.attachTo = function (root) {
            return new MDCMenu(root);
        };
        MDCMenu.prototype.initialize = function (menuSurfaceFactory, listFactory) {
            if (menuSurfaceFactory === void 0) { menuSurfaceFactory = function (el) { return new MDCMenuSurface(el); }; }
            if (listFactory === void 0) { listFactory = function (el) { return new MDCList(el); }; }
            this.menuSurfaceFactory_ = menuSurfaceFactory;
            this.listFactory_ = listFactory;
        };
        MDCMenu.prototype.initialSyncWithDOM = function () {
            var _this = this;
            this.menuSurface_ = this.menuSurfaceFactory_(this.root_);
            var list = this.root_.querySelector(strings$3.LIST_SELECTOR);
            if (list) {
                this.list_ = this.listFactory_(list);
                this.list_.wrapFocus = true;
            }
            else {
                this.list_ = null;
            }
            this.handleKeydown_ = function (evt) { return _this.foundation_.handleKeydown(evt); };
            this.handleItemAction_ = function (evt) { return _this.foundation_.handleItemAction(_this.items[evt.detail.index]); };
            this.handleMenuSurfaceOpened_ = function () { return _this.foundation_.handleMenuSurfaceOpened(); };
            this.menuSurface_.listen(MDCMenuSurfaceFoundation.strings.OPENED_EVENT, this.handleMenuSurfaceOpened_);
            this.listen('keydown', this.handleKeydown_);
            this.listen(MDCListFoundation.strings.ACTION_EVENT, this.handleItemAction_);
        };
        MDCMenu.prototype.destroy = function () {
            if (this.list_) {
                this.list_.destroy();
            }
            this.menuSurface_.destroy();
            this.menuSurface_.unlisten(MDCMenuSurfaceFoundation.strings.OPENED_EVENT, this.handleMenuSurfaceOpened_);
            this.unlisten('keydown', this.handleKeydown_);
            this.unlisten(MDCListFoundation.strings.ACTION_EVENT, this.handleItemAction_);
            _super.prototype.destroy.call(this);
        };
        Object.defineProperty(MDCMenu.prototype, "open", {
            get: function () {
                return this.menuSurface_.isOpen();
            },
            set: function (value) {
                if (value) {
                    this.menuSurface_.open();
                }
                else {
                    this.menuSurface_.close();
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenu.prototype, "wrapFocus", {
            get: function () {
                return this.list_ ? this.list_.wrapFocus : false;
            },
            set: function (value) {
                if (this.list_) {
                    this.list_.wrapFocus = value;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenu.prototype, "items", {
            /**
             * Return the items within the menu. Note that this only contains the set of elements within
             * the items container that are proper list items, and not supplemental / presentational DOM
             * elements.
             */
            get: function () {
                return this.list_ ? this.list_.listElements : [];
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCMenu.prototype, "quickOpen", {
            set: function (quickOpen) {
                this.menuSurface_.quickOpen = quickOpen;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Sets default focus state where the menu should focus every time when menu
         * is opened. Focuses the list root (`DefaultFocusState.LIST_ROOT`) element by
         * default.
         * @param focusState Default focus state.
         */
        MDCMenu.prototype.setDefaultFocusState = function (focusState) {
            this.foundation_.setDefaultFocusState(focusState);
        };
        /**
         * @param corner Default anchor corner alignment of top-left menu corner.
         */
        MDCMenu.prototype.setAnchorCorner = function (corner) {
            this.menuSurface_.setAnchorCorner(corner);
        };
        MDCMenu.prototype.setAnchorMargin = function (margin) {
            this.menuSurface_.setAnchorMargin(margin);
        };
        /**
         * Sets the list item as the selected row at the specified index.
         * @param index Index of list item within menu.
         */
        MDCMenu.prototype.setSelectedIndex = function (index) {
            this.foundation_.setSelectedIndex(index);
        };
        /**
         * Sets the enabled state to isEnabled for the menu item at the given index.
         * @param index Index of the menu item
         * @param isEnabled The desired enabled state of the menu item.
         */
        MDCMenu.prototype.setEnabled = function (index, isEnabled) {
            this.foundation_.setEnabled(index, isEnabled);
        };
        /**
         * @return The item within the menu at the index specified.
         */
        MDCMenu.prototype.getOptionByIndex = function (index) {
            var items = this.items;
            if (index < items.length) {
                return this.items[index];
            }
            else {
                return null;
            }
        };
        MDCMenu.prototype.setFixedPosition = function (isFixed) {
            this.menuSurface_.setFixedPosition(isFixed);
        };
        MDCMenu.prototype.hoistMenuToBody = function () {
            this.menuSurface_.hoistMenuToBody();
        };
        MDCMenu.prototype.setIsHoisted = function (isHoisted) {
            this.menuSurface_.setIsHoisted(isHoisted);
        };
        MDCMenu.prototype.setAbsolutePosition = function (x, y) {
            this.menuSurface_.setAbsolutePosition(x, y);
        };
        /**
         * Sets the element that the menu-surface is anchored to.
         */
        MDCMenu.prototype.setAnchorElement = function (element) {
            this.menuSurface_.anchorElement = element;
        };
        MDCMenu.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = {
                addClassToElementAtIndex: function (index, className) {
                    var list = _this.items;
                    list[index].classList.add(className);
                },
                removeClassFromElementAtIndex: function (index, className) {
                    var list = _this.items;
                    list[index].classList.remove(className);
                },
                addAttributeToElementAtIndex: function (index, attr, value) {
                    var list = _this.items;
                    list[index].setAttribute(attr, value);
                },
                removeAttributeFromElementAtIndex: function (index, attr) {
                    var list = _this.items;
                    list[index].removeAttribute(attr);
                },
                elementContainsClass: function (element, className) { return element.classList.contains(className); },
                closeSurface: function (skipRestoreFocus) { return _this.menuSurface_.close(skipRestoreFocus); },
                getElementIndex: function (element) { return _this.items.indexOf(element); },
                notifySelected: function (evtData) { return _this.emit(strings$3.SELECTED_EVENT, {
                    index: evtData.index,
                    item: _this.items[evtData.index],
                }); },
                getMenuItemCount: function () { return _this.items.length; },
                focusItemAtIndex: function (index) { return _this.items[index].focus(); },
                focusListRoot: function () { return _this.root_.querySelector(strings$3.LIST_SELECTOR).focus(); },
                isSelectableItemAtIndex: function (index) { return !!closest(_this.items[index], "." + cssClasses$5.MENU_SELECTION_GROUP); },
                getSelectedSiblingOfItemAtIndex: function (index) {
                    var selectionGroupEl = closest(_this.items[index], "." + cssClasses$5.MENU_SELECTION_GROUP);
                    var selectedItemEl = selectionGroupEl.querySelector("." + cssClasses$5.MENU_SELECTED_LIST_ITEM);
                    return selectedItemEl ? _this.items.indexOf(selectedItemEl) : -1;
                },
            };
            // tslint:enable:object-literal-sort-keys
            return new MDCMenuFoundation(adapter);
        };
        return MDCMenu;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var strings$4 = {
        NOTCH_ELEMENT_SELECTOR: '.mdc-notched-outline__notch',
    };
    var numbers$4 = {
        // This should stay in sync with $mdc-notched-outline-padding * 2.
        NOTCH_ELEMENT_PADDING: 8,
    };
    var cssClasses$6 = {
        NO_LABEL: 'mdc-notched-outline--no-label',
        OUTLINE_NOTCHED: 'mdc-notched-outline--notched',
        OUTLINE_UPGRADED: 'mdc-notched-outline--upgraded',
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2017 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCNotchedOutlineFoundation = /** @class */ (function (_super) {
        __extends(MDCNotchedOutlineFoundation, _super);
        function MDCNotchedOutlineFoundation(adapter) {
            return _super.call(this, __assign({}, MDCNotchedOutlineFoundation.defaultAdapter, adapter)) || this;
        }
        Object.defineProperty(MDCNotchedOutlineFoundation, "strings", {
            get: function () {
                return strings$4;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCNotchedOutlineFoundation, "cssClasses", {
            get: function () {
                return cssClasses$6;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCNotchedOutlineFoundation, "numbers", {
            get: function () {
                return numbers$4;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCNotchedOutlineFoundation, "defaultAdapter", {
            /**
             * See {@link MDCNotchedOutlineAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    setNotchWidthProperty: function () { return undefined; },
                    removeNotchWidthProperty: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Adds the outline notched selector and updates the notch width calculated based off of notchWidth.
         */
        MDCNotchedOutlineFoundation.prototype.notch = function (notchWidth) {
            var OUTLINE_NOTCHED = MDCNotchedOutlineFoundation.cssClasses.OUTLINE_NOTCHED;
            if (notchWidth > 0) {
                notchWidth += numbers$4.NOTCH_ELEMENT_PADDING; // Add padding from left/right.
            }
            this.adapter_.setNotchWidthProperty(notchWidth);
            this.adapter_.addClass(OUTLINE_NOTCHED);
        };
        /**
         * Removes notched outline selector to close the notch in the outline.
         */
        MDCNotchedOutlineFoundation.prototype.closeNotch = function () {
            var OUTLINE_NOTCHED = MDCNotchedOutlineFoundation.cssClasses.OUTLINE_NOTCHED;
            this.adapter_.removeClass(OUTLINE_NOTCHED);
            this.adapter_.removeNotchWidthProperty();
        };
        return MDCNotchedOutlineFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2017 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCNotchedOutline = /** @class */ (function (_super) {
        __extends(MDCNotchedOutline, _super);
        function MDCNotchedOutline() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCNotchedOutline.attachTo = function (root) {
            return new MDCNotchedOutline(root);
        };
        MDCNotchedOutline.prototype.initialSyncWithDOM = function () {
            this.notchElement_ = this.root_.querySelector(strings$4.NOTCH_ELEMENT_SELECTOR);
            var label = this.root_.querySelector('.' + MDCFloatingLabelFoundation.cssClasses.ROOT);
            if (label) {
                label.style.transitionDuration = '0s';
                this.root_.classList.add(cssClasses$6.OUTLINE_UPGRADED);
                requestAnimationFrame(function () {
                    label.style.transitionDuration = '';
                });
            }
            else {
                this.root_.classList.add(cssClasses$6.NO_LABEL);
            }
        };
        /**
         * Updates classes and styles to open the notch to the specified width.
         * @param notchWidth The notch width in the outline.
         */
        MDCNotchedOutline.prototype.notch = function (notchWidth) {
            this.foundation_.notch(notchWidth);
        };
        /**
         * Updates classes and styles to close the notch.
         */
        MDCNotchedOutline.prototype.closeNotch = function () {
            this.foundation_.closeNotch();
        };
        MDCNotchedOutline.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = {
                addClass: function (className) { return _this.root_.classList.add(className); },
                removeClass: function (className) { return _this.root_.classList.remove(className); },
                setNotchWidthProperty: function (width) { return _this.notchElement_.style.setProperty('width', width + 'px'); },
                removeNotchWidthProperty: function () { return _this.notchElement_.style.removeProperty('width'); },
            };
            // tslint:enable:object-literal-sort-keys
            return new MDCNotchedOutlineFoundation(adapter);
        };
        return MDCNotchedOutline;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$7 = {
        ACTIVATED: 'mdc-select--activated',
        DISABLED: 'mdc-select--disabled',
        FOCUSED: 'mdc-select--focused',
        INVALID: 'mdc-select--invalid',
        OUTLINED: 'mdc-select--outlined',
        REQUIRED: 'mdc-select--required',
        ROOT: 'mdc-select',
        SELECTED_ITEM_CLASS: 'mdc-list-item--selected',
        WITH_LEADING_ICON: 'mdc-select--with-leading-icon',
    };
    var strings$5 = {
        ARIA_CONTROLS: 'aria-controls',
        ARIA_SELECTED_ATTR: 'aria-selected',
        CHANGE_EVENT: 'MDCSelect:change',
        ENHANCED_VALUE_ATTR: 'data-value',
        HIDDEN_INPUT_SELECTOR: 'input[type="hidden"]',
        LABEL_SELECTOR: '.mdc-floating-label',
        LEADING_ICON_SELECTOR: '.mdc-select__icon',
        LINE_RIPPLE_SELECTOR: '.mdc-line-ripple',
        MENU_SELECTOR: '.mdc-select__menu',
        NATIVE_CONTROL_SELECTOR: '.mdc-select__native-control',
        OUTLINE_SELECTOR: '.mdc-notched-outline',
        SELECTED_ITEM_SELECTOR: "." + cssClasses$7.SELECTED_ITEM_CLASS,
        SELECTED_TEXT_SELECTOR: '.mdc-select__selected-text',
    };
    var numbers$5 = {
        LABEL_SCALE: 0.75,
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCSelectFoundation = /** @class */ (function (_super) {
        __extends(MDCSelectFoundation, _super);
        /* istanbul ignore next: optional argument is not a branch statement */
        /**
         * @param adapter
         * @param foundationMap Map from subcomponent names to their subfoundations.
         */
        function MDCSelectFoundation(adapter, foundationMap) {
            if (foundationMap === void 0) { foundationMap = {}; }
            var _this = _super.call(this, __assign({}, MDCSelectFoundation.defaultAdapter, adapter)) || this;
            _this.leadingIcon_ = foundationMap.leadingIcon;
            _this.helperText_ = foundationMap.helperText;
            return _this;
        }
        Object.defineProperty(MDCSelectFoundation, "cssClasses", {
            get: function () {
                return cssClasses$7;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelectFoundation, "numbers", {
            get: function () {
                return numbers$5;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelectFoundation, "strings", {
            get: function () {
                return strings$5;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelectFoundation, "defaultAdapter", {
            /**
             * See {@link MDCSelectAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    hasClass: function () { return false; },
                    activateBottomLine: function () { return undefined; },
                    deactivateBottomLine: function () { return undefined; },
                    setValue: function () { return undefined; },
                    getValue: function () { return ''; },
                    floatLabel: function () { return undefined; },
                    getLabelWidth: function () { return 0; },
                    hasOutline: function () { return false; },
                    notchOutline: function () { return undefined; },
                    closeOutline: function () { return undefined; },
                    openMenu: function () { return undefined; },
                    closeMenu: function () { return undefined; },
                    isMenuOpen: function () { return false; },
                    setSelectedIndex: function () { return undefined; },
                    setDisabled: function () { return undefined; },
                    setRippleCenter: function () { return undefined; },
                    notifyChange: function () { return undefined; },
                    checkValidity: function () { return false; },
                    setValid: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        MDCSelectFoundation.prototype.setSelectedIndex = function (index) {
            this.adapter_.setSelectedIndex(index);
            this.adapter_.closeMenu();
            var didChange = true;
            this.handleChange(didChange);
        };
        MDCSelectFoundation.prototype.setValue = function (value) {
            this.adapter_.setValue(value);
            var didChange = true;
            this.handleChange(didChange);
        };
        MDCSelectFoundation.prototype.getValue = function () {
            return this.adapter_.getValue();
        };
        MDCSelectFoundation.prototype.setDisabled = function (isDisabled) {
            if (isDisabled) {
                this.adapter_.addClass(cssClasses$7.DISABLED);
            }
            else {
                this.adapter_.removeClass(cssClasses$7.DISABLED);
            }
            this.adapter_.setDisabled(isDisabled);
            this.adapter_.closeMenu();
            if (this.leadingIcon_) {
                this.leadingIcon_.setDisabled(isDisabled);
            }
        };
        /**
         * @param content Sets the content of the helper text.
         */
        MDCSelectFoundation.prototype.setHelperTextContent = function (content) {
            if (this.helperText_) {
                this.helperText_.setContent(content);
            }
        };
        MDCSelectFoundation.prototype.layout = function () {
            var openNotch = this.getValue().length > 0;
            this.notchOutline(openNotch);
        };
        MDCSelectFoundation.prototype.handleMenuOpened = function () {
            this.adapter_.addClass(cssClasses$7.ACTIVATED);
        };
        MDCSelectFoundation.prototype.handleMenuClosed = function () {
            this.adapter_.removeClass(cssClasses$7.ACTIVATED);
        };
        /**
         * Handles value changes, via change event or programmatic updates.
         */
        MDCSelectFoundation.prototype.handleChange = function (didChange) {
            if (didChange === void 0) { didChange = true; }
            var value = this.getValue();
            var optionHasValue = value.length > 0;
            var isRequired = this.adapter_.hasClass(cssClasses$7.REQUIRED);
            this.notchOutline(optionHasValue);
            if (!this.adapter_.hasClass(cssClasses$7.FOCUSED)) {
                this.adapter_.floatLabel(optionHasValue);
            }
            if (didChange) {
                this.adapter_.notifyChange(value);
                if (isRequired) {
                    this.setValid(this.isValid());
                    if (this.helperText_) {
                        this.helperText_.setValidity(this.isValid());
                    }
                }
            }
        };
        /**
         * Handles focus events from select element.
         */
        MDCSelectFoundation.prototype.handleFocus = function () {
            this.adapter_.addClass(cssClasses$7.FOCUSED);
            this.adapter_.floatLabel(true);
            this.notchOutline(true);
            this.adapter_.activateBottomLine();
            if (this.helperText_) {
                this.helperText_.showToScreenReader();
            }
        };
        /**
         * Handles blur events from select element.
         */
        MDCSelectFoundation.prototype.handleBlur = function () {
            if (this.adapter_.isMenuOpen()) {
                return;
            }
            this.adapter_.removeClass(cssClasses$7.FOCUSED);
            this.handleChange(false);
            this.adapter_.deactivateBottomLine();
            var isRequired = this.adapter_.hasClass(cssClasses$7.REQUIRED);
            if (isRequired) {
                this.setValid(this.isValid());
                if (this.helperText_) {
                    this.helperText_.setValidity(this.isValid());
                }
            }
        };
        MDCSelectFoundation.prototype.handleClick = function (normalizedX) {
            if (this.adapter_.isMenuOpen()) {
                return;
            }
            this.adapter_.setRippleCenter(normalizedX);
            this.adapter_.openMenu();
        };
        MDCSelectFoundation.prototype.handleKeydown = function (event) {
            if (this.adapter_.isMenuOpen()) {
                return;
            }
            var isEnter = event.key === 'Enter' || event.keyCode === 13;
            var isSpace = event.key === 'Space' || event.keyCode === 32;
            var arrowUp = event.key === 'ArrowUp' || event.keyCode === 38;
            var arrowDown = event.key === 'ArrowDown' || event.keyCode === 40;
            if (this.adapter_.hasClass(cssClasses$7.FOCUSED) && (isEnter || isSpace || arrowUp || arrowDown)) {
                this.adapter_.openMenu();
                event.preventDefault();
            }
        };
        /**
         * Opens/closes the notched outline.
         */
        MDCSelectFoundation.prototype.notchOutline = function (openNotch) {
            if (!this.adapter_.hasOutline()) {
                return;
            }
            var isFocused = this.adapter_.hasClass(cssClasses$7.FOCUSED);
            if (openNotch) {
                var labelScale = numbers$5.LABEL_SCALE;
                var labelWidth = this.adapter_.getLabelWidth() * labelScale;
                this.adapter_.notchOutline(labelWidth);
            }
            else if (!isFocused) {
                this.adapter_.closeOutline();
            }
        };
        /**
         * Sets the aria label of the leading icon.
         */
        MDCSelectFoundation.prototype.setLeadingIconAriaLabel = function (label) {
            if (this.leadingIcon_) {
                this.leadingIcon_.setAriaLabel(label);
            }
        };
        /**
         * Sets the text content of the leading icon.
         */
        MDCSelectFoundation.prototype.setLeadingIconContent = function (content) {
            if (this.leadingIcon_) {
                this.leadingIcon_.setContent(content);
            }
        };
        MDCSelectFoundation.prototype.setValid = function (isValid) {
            this.adapter_.setValid(isValid);
        };
        MDCSelectFoundation.prototype.isValid = function () {
            return this.adapter_.checkValidity();
        };
        return MDCSelectFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var strings$6 = {
        ARIA_HIDDEN: 'aria-hidden',
        ROLE: 'role',
    };
    var cssClasses$8 = {
        HELPER_TEXT_PERSISTENT: 'mdc-select-helper-text--persistent',
        HELPER_TEXT_VALIDATION_MSG: 'mdc-select-helper-text--validation-msg',
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCSelectHelperTextFoundation = /** @class */ (function (_super) {
        __extends(MDCSelectHelperTextFoundation, _super);
        function MDCSelectHelperTextFoundation(adapter) {
            return _super.call(this, __assign({}, MDCSelectHelperTextFoundation.defaultAdapter, adapter)) || this;
        }
        Object.defineProperty(MDCSelectHelperTextFoundation, "cssClasses", {
            get: function () {
                return cssClasses$8;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelectHelperTextFoundation, "strings", {
            get: function () {
                return strings$6;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelectHelperTextFoundation, "defaultAdapter", {
            /**
             * See {@link MDCSelectHelperTextAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    hasClass: function () { return false; },
                    setAttr: function () { return undefined; },
                    removeAttr: function () { return undefined; },
                    setContent: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Sets the content of the helper text field.
         */
        MDCSelectHelperTextFoundation.prototype.setContent = function (content) {
            this.adapter_.setContent(content);
        };
        /**
         *  Sets the persistency of the helper text.
         */
        MDCSelectHelperTextFoundation.prototype.setPersistent = function (isPersistent) {
            if (isPersistent) {
                this.adapter_.addClass(cssClasses$8.HELPER_TEXT_PERSISTENT);
            }
            else {
                this.adapter_.removeClass(cssClasses$8.HELPER_TEXT_PERSISTENT);
            }
        };
        /**
         * @param isValidation True to make the helper text act as an error validation message.
         */
        MDCSelectHelperTextFoundation.prototype.setValidation = function (isValidation) {
            if (isValidation) {
                this.adapter_.addClass(cssClasses$8.HELPER_TEXT_VALIDATION_MSG);
            }
            else {
                this.adapter_.removeClass(cssClasses$8.HELPER_TEXT_VALIDATION_MSG);
            }
        };
        /**
         * Makes the helper text visible to screen readers.
         */
        MDCSelectHelperTextFoundation.prototype.showToScreenReader = function () {
            this.adapter_.removeAttr(strings$6.ARIA_HIDDEN);
        };
        /**
         * Sets the validity of the helper text based on the select validity.
         */
        MDCSelectHelperTextFoundation.prototype.setValidity = function (selectIsValid) {
            var helperTextIsPersistent = this.adapter_.hasClass(cssClasses$8.HELPER_TEXT_PERSISTENT);
            var helperTextIsValidationMsg = this.adapter_.hasClass(cssClasses$8.HELPER_TEXT_VALIDATION_MSG);
            var validationMsgNeedsDisplay = helperTextIsValidationMsg && !selectIsValid;
            if (validationMsgNeedsDisplay) {
                this.adapter_.setAttr(strings$6.ROLE, 'alert');
            }
            else {
                this.adapter_.removeAttr(strings$6.ROLE);
            }
            if (!helperTextIsPersistent && !validationMsgNeedsDisplay) {
                this.hide_();
            }
        };
        /**
         * Hides the help text from screen readers.
         */
        MDCSelectHelperTextFoundation.prototype.hide_ = function () {
            this.adapter_.setAttr(strings$6.ARIA_HIDDEN, 'true');
        };
        return MDCSelectHelperTextFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCSelectHelperText = /** @class */ (function (_super) {
        __extends(MDCSelectHelperText, _super);
        function MDCSelectHelperText() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCSelectHelperText.attachTo = function (root) {
            return new MDCSelectHelperText(root);
        };
        Object.defineProperty(MDCSelectHelperText.prototype, "foundation", {
            get: function () {
                return this.foundation_;
            },
            enumerable: true,
            configurable: true
        });
        MDCSelectHelperText.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = {
                addClass: function (className) { return _this.root_.classList.add(className); },
                removeClass: function (className) { return _this.root_.classList.remove(className); },
                hasClass: function (className) { return _this.root_.classList.contains(className); },
                setAttr: function (attr, value) { return _this.root_.setAttribute(attr, value); },
                removeAttr: function (attr) { return _this.root_.removeAttribute(attr); },
                setContent: function (content) {
                    _this.root_.textContent = content;
                },
            };
            // tslint:enable:object-literal-sort-keys
            return new MDCSelectHelperTextFoundation(adapter);
        };
        return MDCSelectHelperText;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var strings$7 = {
        ICON_EVENT: 'MDCSelect:icon',
        ICON_ROLE: 'button',
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var INTERACTION_EVENTS = ['click', 'keydown'];
    var MDCSelectIconFoundation = /** @class */ (function (_super) {
        __extends(MDCSelectIconFoundation, _super);
        function MDCSelectIconFoundation(adapter) {
            var _this = _super.call(this, __assign({}, MDCSelectIconFoundation.defaultAdapter, adapter)) || this;
            _this.savedTabIndex_ = null;
            _this.interactionHandler_ = function (evt) { return _this.handleInteraction(evt); };
            return _this;
        }
        Object.defineProperty(MDCSelectIconFoundation, "strings", {
            get: function () {
                return strings$7;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelectIconFoundation, "defaultAdapter", {
            /**
             * See {@link MDCSelectIconAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    getAttr: function () { return null; },
                    setAttr: function () { return undefined; },
                    removeAttr: function () { return undefined; },
                    setContent: function () { return undefined; },
                    registerInteractionHandler: function () { return undefined; },
                    deregisterInteractionHandler: function () { return undefined; },
                    notifyIconAction: function () { return undefined; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        MDCSelectIconFoundation.prototype.init = function () {
            var _this = this;
            this.savedTabIndex_ = this.adapter_.getAttr('tabindex');
            INTERACTION_EVENTS.forEach(function (evtType) {
                _this.adapter_.registerInteractionHandler(evtType, _this.interactionHandler_);
            });
        };
        MDCSelectIconFoundation.prototype.destroy = function () {
            var _this = this;
            INTERACTION_EVENTS.forEach(function (evtType) {
                _this.adapter_.deregisterInteractionHandler(evtType, _this.interactionHandler_);
            });
        };
        MDCSelectIconFoundation.prototype.setDisabled = function (disabled) {
            if (!this.savedTabIndex_) {
                return;
            }
            if (disabled) {
                this.adapter_.setAttr('tabindex', '-1');
                this.adapter_.removeAttr('role');
            }
            else {
                this.adapter_.setAttr('tabindex', this.savedTabIndex_);
                this.adapter_.setAttr('role', strings$7.ICON_ROLE);
            }
        };
        MDCSelectIconFoundation.prototype.setAriaLabel = function (label) {
            this.adapter_.setAttr('aria-label', label);
        };
        MDCSelectIconFoundation.prototype.setContent = function (content) {
            this.adapter_.setContent(content);
        };
        MDCSelectIconFoundation.prototype.handleInteraction = function (evt) {
            var isEnterKey = evt.key === 'Enter' || evt.keyCode === 13;
            if (evt.type === 'click' || isEnterKey) {
                this.adapter_.notifyIconAction();
            }
        };
        return MDCSelectIconFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCSelectIcon = /** @class */ (function (_super) {
        __extends(MDCSelectIcon, _super);
        function MDCSelectIcon() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCSelectIcon.attachTo = function (root) {
            return new MDCSelectIcon(root);
        };
        Object.defineProperty(MDCSelectIcon.prototype, "foundation", {
            get: function () {
                return this.foundation_;
            },
            enumerable: true,
            configurable: true
        });
        MDCSelectIcon.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = {
                getAttr: function (attr) { return _this.root_.getAttribute(attr); },
                setAttr: function (attr, value) { return _this.root_.setAttribute(attr, value); },
                removeAttr: function (attr) { return _this.root_.removeAttribute(attr); },
                setContent: function (content) {
                    _this.root_.textContent = content;
                },
                registerInteractionHandler: function (evtType, handler) { return _this.listen(evtType, handler); },
                deregisterInteractionHandler: function (evtType, handler) { return _this.unlisten(evtType, handler); },
                notifyIconAction: function () { return _this.emit(MDCSelectIconFoundation.strings.ICON_EVENT, {} /* evtData */, true /* shouldBubble */); },
            };
            // tslint:enable:object-literal-sort-keys
            return new MDCSelectIconFoundation(adapter);
        };
        return MDCSelectIcon;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /**
     * @license
     * Copyright 2016 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var VALIDATION_ATTR_WHITELIST = ['required', 'aria-required'];
    var MDCSelect = /** @class */ (function (_super) {
        __extends(MDCSelect, _super);
        function MDCSelect() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCSelect.attachTo = function (root) {
            return new MDCSelect(root);
        };
        MDCSelect.prototype.initialize = function (labelFactory, lineRippleFactory, outlineFactory, menuFactory, iconFactory, helperTextFactory) {
            if (labelFactory === void 0) { labelFactory = function (el) { return new MDCFloatingLabel(el); }; }
            if (lineRippleFactory === void 0) { lineRippleFactory = function (el) { return new MDCLineRipple(el); }; }
            if (outlineFactory === void 0) { outlineFactory = function (el) { return new MDCNotchedOutline(el); }; }
            if (menuFactory === void 0) { menuFactory = function (el) { return new MDCMenu(el); }; }
            if (iconFactory === void 0) { iconFactory = function (el) { return new MDCSelectIcon(el); }; }
            if (helperTextFactory === void 0) { helperTextFactory = function (el) { return new MDCSelectHelperText(el); }; }
            this.isMenuOpen_ = false;
            this.nativeControl_ = this.root_.querySelector(strings$5.NATIVE_CONTROL_SELECTOR);
            this.selectedText_ = this.root_.querySelector(strings$5.SELECTED_TEXT_SELECTOR);
            var targetElement = this.nativeControl_ || this.selectedText_;
            if (!targetElement) {
                throw new Error('MDCSelect: Missing required element: Exactly one of the following selectors must be present: ' +
                    ("'" + strings$5.NATIVE_CONTROL_SELECTOR + "' or '" + strings$5.SELECTED_TEXT_SELECTOR + "'"));
            }
            this.targetElement_ = targetElement;
            if (this.targetElement_.hasAttribute(strings$5.ARIA_CONTROLS)) {
                var helperTextElement = document.getElementById(this.targetElement_.getAttribute(strings$5.ARIA_CONTROLS));
                if (helperTextElement) {
                    this.helperText_ = helperTextFactory(helperTextElement);
                }
            }
            if (this.selectedText_) {
                this.enhancedSelectSetup_(menuFactory);
            }
            var labelElement = this.root_.querySelector(strings$5.LABEL_SELECTOR);
            this.label_ = labelElement ? labelFactory(labelElement) : null;
            var lineRippleElement = this.root_.querySelector(strings$5.LINE_RIPPLE_SELECTOR);
            this.lineRipple_ = lineRippleElement ? lineRippleFactory(lineRippleElement) : null;
            var outlineElement = this.root_.querySelector(strings$5.OUTLINE_SELECTOR);
            this.outline_ = outlineElement ? outlineFactory(outlineElement) : null;
            var leadingIcon = this.root_.querySelector(strings$5.LEADING_ICON_SELECTOR);
            if (leadingIcon) {
                this.root_.classList.add(cssClasses$7.WITH_LEADING_ICON);
                this.leadingIcon_ = iconFactory(leadingIcon);
                if (this.menuElement_) {
                    this.menuElement_.classList.add(cssClasses$7.WITH_LEADING_ICON);
                }
            }
            if (!this.root_.classList.contains(cssClasses$7.OUTLINED)) {
                this.ripple = this.createRipple_();
            }
            // The required state needs to be sync'd before the mutation observer is added.
            this.initialSyncRequiredState_();
            this.addMutationObserverForRequired_();
        };
        /**
         * Initializes the select's event listeners and internal state based
         * on the environment's state.
         */
        MDCSelect.prototype.initialSyncWithDOM = function () {
            var _this = this;
            this.handleChange_ = function () { return _this.foundation_.handleChange(/* didChange */ true); };
            this.handleFocus_ = function () { return _this.foundation_.handleFocus(); };
            this.handleBlur_ = function () { return _this.foundation_.handleBlur(); };
            this.handleClick_ = function (evt) {
                if (_this.selectedText_) {
                    _this.selectedText_.focus();
                }
                _this.foundation_.handleClick(_this.getNormalizedXCoordinate_(evt));
            };
            this.handleKeydown_ = function (evt) { return _this.foundation_.handleKeydown(evt); };
            this.handleMenuSelected_ = function (evtData) { return _this.selectedIndex = evtData.detail.index; };
            this.handleMenuOpened_ = function () {
                _this.foundation_.handleMenuOpened();
                if (_this.menu_.items.length === 0) {
                    return;
                }
                // Menu should open to the last selected element, should open to first menu item otherwise.
                var focusItemIndex = _this.selectedIndex >= 0 ? _this.selectedIndex : 0;
                var focusItemEl = _this.menu_.items[focusItemIndex];
                focusItemEl.focus();
            };
            this.handleMenuClosed_ = function () {
                _this.foundation_.handleMenuClosed();
                // isMenuOpen_ is used to track the state of the menu opening or closing since the menu.open function
                // will return false if the menu is still closing and this method listens to the closed event which
                // occurs after the menu is already closed.
                _this.isMenuOpen_ = false;
                _this.selectedText_.removeAttribute('aria-expanded');
                if (document.activeElement !== _this.selectedText_) {
                    _this.foundation_.handleBlur();
                }
            };
            this.targetElement_.addEventListener('change', this.handleChange_);
            this.targetElement_.addEventListener('focus', this.handleFocus_);
            this.targetElement_.addEventListener('blur', this.handleBlur_);
            this.targetElement_.addEventListener('click', this.handleClick_);
            if (this.menuElement_) {
                this.selectedText_.addEventListener('keydown', this.handleKeydown_);
                this.menu_.listen(strings$1.CLOSED_EVENT, this.handleMenuClosed_);
                this.menu_.listen(strings$1.OPENED_EVENT, this.handleMenuOpened_);
                this.menu_.listen(strings$3.SELECTED_EVENT, this.handleMenuSelected_);
                if (this.hiddenInput_ && this.hiddenInput_.value) {
                    // If the hidden input already has a value, use it to restore the select's value.
                    // This can happen e.g. if the user goes back or (in some browsers) refreshes the page.
                    var enhancedAdapterMethods = this.getEnhancedSelectAdapterMethods_();
                    enhancedAdapterMethods.setValue(this.hiddenInput_.value);
                }
                else if (this.menuElement_.querySelector(strings$5.SELECTED_ITEM_SELECTOR)) {
                    // If an element is selected, the select should set the initial selected text.
                    var enhancedAdapterMethods = this.getEnhancedSelectAdapterMethods_();
                    enhancedAdapterMethods.setValue(enhancedAdapterMethods.getValue());
                }
            }
            // Initially sync floating label
            this.foundation_.handleChange(/* didChange */ false);
            if (this.root_.classList.contains(cssClasses$7.DISABLED)
                || (this.nativeControl_ && this.nativeControl_.disabled)) {
                this.disabled = true;
            }
        };
        MDCSelect.prototype.destroy = function () {
            this.targetElement_.removeEventListener('change', this.handleChange_);
            this.targetElement_.removeEventListener('focus', this.handleFocus_);
            this.targetElement_.removeEventListener('blur', this.handleBlur_);
            this.targetElement_.removeEventListener('keydown', this.handleKeydown_);
            this.targetElement_.removeEventListener('click', this.handleClick_);
            if (this.menu_) {
                this.menu_.unlisten(strings$1.CLOSED_EVENT, this.handleMenuClosed_);
                this.menu_.unlisten(strings$1.OPENED_EVENT, this.handleMenuOpened_);
                this.menu_.unlisten(strings$3.SELECTED_EVENT, this.handleMenuSelected_);
                this.menu_.destroy();
            }
            if (this.ripple) {
                this.ripple.destroy();
            }
            if (this.outline_) {
                this.outline_.destroy();
            }
            if (this.leadingIcon_) {
                this.leadingIcon_.destroy();
            }
            if (this.helperText_) {
                this.helperText_.destroy();
            }
            if (this.validationObserver_) {
                this.validationObserver_.disconnect();
            }
            _super.prototype.destroy.call(this);
        };
        Object.defineProperty(MDCSelect.prototype, "value", {
            get: function () {
                return this.foundation_.getValue();
            },
            set: function (value) {
                this.foundation_.setValue(value);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelect.prototype, "selectedIndex", {
            get: function () {
                var selectedIndex = -1;
                if (this.menuElement_ && this.menu_) {
                    var selectedEl = this.menuElement_.querySelector(strings$5.SELECTED_ITEM_SELECTOR);
                    selectedIndex = this.menu_.items.indexOf(selectedEl);
                }
                else if (this.nativeControl_) {
                    selectedIndex = this.nativeControl_.selectedIndex;
                }
                return selectedIndex;
            },
            set: function (selectedIndex) {
                this.foundation_.setSelectedIndex(selectedIndex);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelect.prototype, "disabled", {
            get: function () {
                return this.root_.classList.contains(cssClasses$7.DISABLED) ||
                    (this.nativeControl_ ? this.nativeControl_.disabled : false);
            },
            set: function (disabled) {
                this.foundation_.setDisabled(disabled);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelect.prototype, "leadingIconAriaLabel", {
            set: function (label) {
                this.foundation_.setLeadingIconAriaLabel(label);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelect.prototype, "leadingIconContent", {
            /**
             * Sets the text content of the leading icon.
             */
            set: function (content) {
                this.foundation_.setLeadingIconContent(content);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelect.prototype, "helperTextContent", {
            /**
             * Sets the text content of the helper text.
             */
            set: function (content) {
                this.foundation_.setHelperTextContent(content);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelect.prototype, "valid", {
            /**
             * Checks if the select is in a valid state.
             */
            get: function () {
                return this.foundation_.isValid();
            },
            /**
             * Sets the current invalid state of the select.
             */
            set: function (isValid) {
                this.foundation_.setValid(isValid);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCSelect.prototype, "required", {
            /**
             * Returns whether the select is required.
             */
            get: function () {
                if (this.nativeControl_) {
                    return this.nativeControl_.required;
                }
                else {
                    return this.selectedText_.getAttribute('aria-required') === 'true';
                }
            },
            /**
             * Sets the control to the required state.
             */
            set: function (isRequired) {
                if (this.nativeControl_) {
                    this.nativeControl_.required = isRequired;
                }
                else {
                    if (isRequired) {
                        this.selectedText_.setAttribute('aria-required', isRequired.toString());
                    }
                    else {
                        this.selectedText_.removeAttribute('aria-required');
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Recomputes the outline SVG path for the outline element.
         */
        MDCSelect.prototype.layout = function () {
            this.foundation_.layout();
        };
        MDCSelect.prototype.getDefaultFoundation = function () {
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            var adapter = __assign({}, (this.nativeControl_ ? this.getNativeSelectAdapterMethods_() : this.getEnhancedSelectAdapterMethods_()), this.getCommonAdapterMethods_(), this.getOutlineAdapterMethods_(), this.getLabelAdapterMethods_());
            return new MDCSelectFoundation(adapter, this.getFoundationMap_());
        };
        /**
         * Handles setup for the enhanced menu.
         */
        MDCSelect.prototype.enhancedSelectSetup_ = function (menuFactory) {
            var isDisabled = this.root_.classList.contains(cssClasses$7.DISABLED);
            this.selectedText_.setAttribute('tabindex', isDisabled ? '-1' : '0');
            this.hiddenInput_ = this.root_.querySelector(strings$5.HIDDEN_INPUT_SELECTOR);
            this.menuElement_ = this.root_.querySelector(strings$5.MENU_SELECTOR);
            this.menu_ = menuFactory(this.menuElement_);
            this.menu_.hoistMenuToBody();
            this.menu_.setAnchorElement(this.root_);
            this.menu_.setAnchorCorner(Corner.BOTTOM_START);
            this.menu_.wrapFocus = false;
        };
        MDCSelect.prototype.createRipple_ = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = __assign({}, MDCRipple.createAdapter(this), { registerInteractionHandler: function (evtType, handler) { return _this.targetElement_.addEventListener(evtType, handler); }, deregisterInteractionHandler: function (evtType, handler) { return _this.targetElement_.removeEventListener(evtType, handler); } });
            // tslint:enable:object-literal-sort-keys
            return new MDCRipple(this.root_, new MDCRippleFoundation(adapter));
        };
        MDCSelect.prototype.getNativeSelectAdapterMethods_ = function () {
            var _this = this;
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            return {
                getValue: function () { return _this.nativeControl_.value; },
                setValue: function (value) {
                    _this.nativeControl_.value = value;
                },
                openMenu: function () { return undefined; },
                closeMenu: function () { return undefined; },
                isMenuOpen: function () { return false; },
                setSelectedIndex: function (index) {
                    _this.nativeControl_.selectedIndex = index;
                },
                setDisabled: function (isDisabled) {
                    _this.nativeControl_.disabled = isDisabled;
                },
                setValid: function (isValid) {
                    if (isValid) {
                        _this.root_.classList.remove(cssClasses$7.INVALID);
                    }
                    else {
                        _this.root_.classList.add(cssClasses$7.INVALID);
                    }
                },
                checkValidity: function () { return _this.nativeControl_.checkValidity(); },
            };
            // tslint:enable:object-literal-sort-keys
        };
        MDCSelect.prototype.getEnhancedSelectAdapterMethods_ = function () {
            var _this = this;
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            return {
                getValue: function () {
                    var listItem = _this.menuElement_.querySelector(strings$5.SELECTED_ITEM_SELECTOR);
                    if (listItem && listItem.hasAttribute(strings$5.ENHANCED_VALUE_ATTR)) {
                        return listItem.getAttribute(strings$5.ENHANCED_VALUE_ATTR) || '';
                    }
                    return '';
                },
                setValue: function (value) {
                    var element = _this.menuElement_.querySelector("[" + strings$5.ENHANCED_VALUE_ATTR + "=\"" + value + "\"]");
                    _this.setEnhancedSelectedIndex_(element ? _this.menu_.items.indexOf(element) : -1);
                },
                openMenu: function () {
                    if (_this.menu_ && !_this.menu_.open) {
                        _this.menu_.open = true;
                        _this.isMenuOpen_ = true;
                        _this.selectedText_.setAttribute('aria-expanded', 'true');
                    }
                },
                closeMenu: function () {
                    if (_this.menu_ && _this.menu_.open) {
                        _this.menu_.open = false;
                    }
                },
                isMenuOpen: function () { return Boolean(_this.menu_) && _this.isMenuOpen_; },
                setSelectedIndex: function (index) { return _this.setEnhancedSelectedIndex_(index); },
                setDisabled: function (isDisabled) {
                    _this.selectedText_.setAttribute('tabindex', isDisabled ? '-1' : '0');
                    _this.selectedText_.setAttribute('aria-disabled', isDisabled.toString());
                    if (_this.hiddenInput_) {
                        _this.hiddenInput_.disabled = isDisabled;
                    }
                },
                checkValidity: function () {
                    var classList = _this.root_.classList;
                    if (classList.contains(cssClasses$7.REQUIRED) && !classList.contains(cssClasses$7.DISABLED)) {
                        // See notes for required attribute under https://www.w3.org/TR/html52/sec-forms.html#the-select-element
                        // TL;DR: Invalid if no index is selected, or if the first index is selected and has an empty value.
                        return _this.selectedIndex !== -1 && (_this.selectedIndex !== 0 || Boolean(_this.value));
                    }
                    else {
                        return true;
                    }
                },
                setValid: function (isValid) {
                    _this.selectedText_.setAttribute('aria-invalid', (!isValid).toString());
                    if (isValid) {
                        _this.root_.classList.remove(cssClasses$7.INVALID);
                    }
                    else {
                        _this.root_.classList.add(cssClasses$7.INVALID);
                    }
                },
            };
            // tslint:enable:object-literal-sort-keys
        };
        MDCSelect.prototype.getCommonAdapterMethods_ = function () {
            var _this = this;
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            return {
                addClass: function (className) { return _this.root_.classList.add(className); },
                removeClass: function (className) { return _this.root_.classList.remove(className); },
                hasClass: function (className) { return _this.root_.classList.contains(className); },
                setRippleCenter: function (normalizedX) { return _this.lineRipple_ && _this.lineRipple_.setRippleCenter(normalizedX); },
                activateBottomLine: function () { return _this.lineRipple_ && _this.lineRipple_.activate(); },
                deactivateBottomLine: function () { return _this.lineRipple_ && _this.lineRipple_.deactivate(); },
                notifyChange: function (value) {
                    var index = _this.selectedIndex;
                    _this.emit(strings$5.CHANGE_EVENT, { value: value, index: index }, true /* shouldBubble  */);
                },
            };
            // tslint:enable:object-literal-sort-keys
        };
        MDCSelect.prototype.getOutlineAdapterMethods_ = function () {
            var _this = this;
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            return {
                hasOutline: function () { return Boolean(_this.outline_); },
                notchOutline: function (labelWidth) { return _this.outline_ && _this.outline_.notch(labelWidth); },
                closeOutline: function () { return _this.outline_ && _this.outline_.closeNotch(); },
            };
            // tslint:enable:object-literal-sort-keys
        };
        MDCSelect.prototype.getLabelAdapterMethods_ = function () {
            var _this = this;
            return {
                floatLabel: function (shouldFloat) { return _this.label_ && _this.label_.float(shouldFloat); },
                getLabelWidth: function () { return _this.label_ ? _this.label_.getWidth() : 0; },
            };
        };
        /**
         * Calculates where the line ripple should start based on the x coordinate within the component.
         */
        MDCSelect.prototype.getNormalizedXCoordinate_ = function (evt) {
            var targetClientRect = evt.target.getBoundingClientRect();
            var xCoordinate = this.isTouchEvent_(evt) ? evt.touches[0].clientX : evt.clientX;
            return xCoordinate - targetClientRect.left;
        };
        MDCSelect.prototype.isTouchEvent_ = function (evt) {
            return Boolean(evt.touches);
        };
        /**
         * Returns a map of all subcomponents to subfoundations.
         */
        MDCSelect.prototype.getFoundationMap_ = function () {
            return {
                helperText: this.helperText_ ? this.helperText_.foundation : undefined,
                leadingIcon: this.leadingIcon_ ? this.leadingIcon_.foundation : undefined,
            };
        };
        MDCSelect.prototype.setEnhancedSelectedIndex_ = function (index) {
            var selectedItem = this.menu_.items[index];
            this.selectedText_.textContent = selectedItem ? selectedItem.textContent.trim() : '';
            var previouslySelected = this.menuElement_.querySelector(strings$5.SELECTED_ITEM_SELECTOR);
            if (previouslySelected) {
                previouslySelected.classList.remove(cssClasses$7.SELECTED_ITEM_CLASS);
                previouslySelected.removeAttribute(strings$5.ARIA_SELECTED_ATTR);
            }
            if (selectedItem) {
                selectedItem.classList.add(cssClasses$7.SELECTED_ITEM_CLASS);
                selectedItem.setAttribute(strings$5.ARIA_SELECTED_ATTR, 'true');
            }
            // Synchronize hidden input's value with data-value attribute of selected item.
            // This code path is also followed when setting value directly, so this covers all cases.
            if (this.hiddenInput_) {
                this.hiddenInput_.value = selectedItem ? selectedItem.getAttribute(strings$5.ENHANCED_VALUE_ATTR) || '' : '';
            }
            this.layout();
        };
        MDCSelect.prototype.initialSyncRequiredState_ = function () {
            var isRequired = this.targetElement_.required
                || this.targetElement_.getAttribute('aria-required') === 'true'
                || this.root_.classList.contains(cssClasses$7.REQUIRED);
            if (isRequired) {
                if (this.nativeControl_) {
                    this.nativeControl_.required = true;
                }
                else {
                    this.selectedText_.setAttribute('aria-required', 'true');
                }
                this.root_.classList.add(cssClasses$7.REQUIRED);
            }
        };
        MDCSelect.prototype.addMutationObserverForRequired_ = function () {
            var _this = this;
            var observerHandler = function (attributesList) {
                attributesList.some(function (attributeName) {
                    if (VALIDATION_ATTR_WHITELIST.indexOf(attributeName) === -1) {
                        return false;
                    }
                    if (_this.selectedText_) {
                        if (_this.selectedText_.getAttribute('aria-required') === 'true') {
                            _this.root_.classList.add(cssClasses$7.REQUIRED);
                        }
                        else {
                            _this.root_.classList.remove(cssClasses$7.REQUIRED);
                        }
                    }
                    else {
                        if (_this.nativeControl_.required) {
                            _this.root_.classList.add(cssClasses$7.REQUIRED);
                        }
                        else {
                            _this.root_.classList.remove(cssClasses$7.REQUIRED);
                        }
                    }
                    return true;
                });
            };
            var getAttributesList = function (mutationsList) {
                return mutationsList
                    .map(function (mutation) { return mutation.attributeName; })
                    .filter(function (attributeName) { return attributeName; });
            };
            var observer = new MutationObserver(function (mutationsList) { return observerHandler(getAttributesList(mutationsList)); });
            observer.observe(this.targetElement_, { attributes: true });
            this.validationObserver_ = observer;
        };
        return MDCSelect;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    function prefixFilter(obj, prefix) {
      let names = Object.getOwnPropertyNames(obj);
      const newObj = {};

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (name.substring(0, prefix.length) === prefix) {
          newObj[name.substring(prefix.length)] = obj[name];
        }
      }

      return newObj;
    }

    /* node_modules/@smui/menu-surface/MenuSurface.svelte generated by Svelte v3.16.0 */
    const file$4 = "node_modules/@smui/menu-surface/MenuSurface.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[27].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[26], null);

    	let div_levels = [
    		{
    			class: "mdc-menu-surface " + /*className*/ ctx[3]
    		},
    		exclude(/*$$props*/ ctx[7], [
    			"use",
    			"class",
    			"static",
    			"anchor",
    			"fixed",
    			"open",
    			"quickOpen",
    			"anchorElement",
    			"anchorCorner",
    			"element"
    		])
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_attributes(div, div_data);
    			toggle_class(div, "mdc-menu-surface--fixed", /*fixed*/ ctx[0]);
    			toggle_class(div, "mdc-menu-surface--open", /*isStatic*/ ctx[4]);
    			toggle_class(div, "smui-menu-surface--static", /*isStatic*/ ctx[4]);
    			add_location(div, file$4, 0, 0, 0);

    			dispose = [
    				listen_dev(div, "MDCMenuSurface:closed", /*updateOpen*/ ctx[6], false, false, false),
    				listen_dev(div, "MDCMenuSurface:opened", /*updateOpen*/ ctx[6], false, false, false)
    			];
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			/*div_binding*/ ctx[28](div);
    			useActions_action = useActions.call(null, div, /*use*/ ctx[2]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[5].call(null, div) || ({});
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 67108864) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[26], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[26], dirty, null));
    			}

    			set_attributes(div, get_spread_update(div_levels, [
    				dirty & /*className*/ 8 && ({
    					class: "mdc-menu-surface " + /*className*/ ctx[3]
    				}),
    				dirty & /*exclude, $$props*/ 128 && exclude(/*$$props*/ ctx[7], [
    					"use",
    					"class",
    					"static",
    					"anchor",
    					"fixed",
    					"open",
    					"quickOpen",
    					"anchorElement",
    					"anchorCorner",
    					"element"
    				])
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 4) useActions_action.update.call(null, /*use*/ ctx[2]);
    			toggle_class(div, "mdc-menu-surface--fixed", /*fixed*/ ctx[0]);
    			toggle_class(div, "mdc-menu-surface--open", /*isStatic*/ ctx[4]);
    			toggle_class(div, "smui-menu-surface--static", /*isStatic*/ ctx[4]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			/*div_binding*/ ctx[28](null);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component, ["MDCMenuSurface:closed", "MDCMenuSurface:opened"]);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { static: isStatic = false } = $$props;
    	let { anchor = true } = $$props;
    	let { fixed = false } = $$props;
    	let { open = isStatic } = $$props;
    	let { quickOpen = false } = $$props;
    	let { anchorElement = null } = $$props;
    	let { anchorCorner = null } = $$props;
    	let { element = undefined } = $$props;
    	let menuSurface;
    	let instantiate = getContext("SMUI:menu-surface:instantiate");
    	let getInstance = getContext("SMUI:menu-surface:getInstance");
    	setContext("SMUI:list:role", "menu");
    	setContext("SMUI:list:item:role", "menuitem");
    	let oldFixed = null;

    	onMount(async () => {
    		if (instantiate !== false) {
    			$$invalidate(22, menuSurface = new MDCMenuSurface(element));
    		} else {
    			$$invalidate(22, menuSurface = await getInstance());
    		}
    	});

    	onDestroy(() => {
    		if (anchor) {
    			element && element.parentNode.classList.remove("mdc-menu-surface--anchor");
    		}

    		let isHoisted = false;

    		if (menuSurface) {
    			isHoisted = menuSurface.foundation_.isHoistedElement_;
    		}

    		if (instantiate !== false) {
    			menuSurface.destroy();
    		}

    		if (isHoisted) {
    			element.parentNode.removeChild(element);
    		}
    	});

    	function updateOpen() {
    		if (menuSurface) {
    			if (isStatic) {
    				$$invalidate(8, open = true);
    			} else {
    				$$invalidate(8, open = menuSurface.isOpen());
    			}
    		}
    	}

    	function setOpen(value) {
    		$$invalidate(8, open = value);
    	}

    	function setAnchorCorner(...args) {
    		return menuSurface.setAnchorCorner(...args);
    	}

    	function setAnchorMargin(...args) {
    		return menuSurface.setAnchorMargin(...args);
    	}

    	function setFixedPosition(isFixed, ...args) {
    		$$invalidate(0, fixed = isFixed);
    		return menuSurface.setFixedPosition(isFixed, ...args);
    	}

    	function setAbsolutePosition(...args) {
    		return menuSurface.setAbsolutePosition(...args);
    	}

    	function setMenuSurfaceAnchorElement(...args) {
    		return menuSurface.setMenuSurfaceAnchorElement(...args);
    	}

    	function hoistMenuToBody(...args) {
    		return menuSurface.hoistMenuToBody(...args);
    	}

    	function setIsHoisted(...args) {
    		return menuSurface.setIsHoisted(...args);
    	}

    	function getDefaultFoundation(...args) {
    		return menuSurface.getDefaultFoundation(...args);
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(1, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(7, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(2, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(3, className = $$new_props.class);
    		if ("static" in $$new_props) $$invalidate(4, isStatic = $$new_props.static);
    		if ("anchor" in $$new_props) $$invalidate(10, anchor = $$new_props.anchor);
    		if ("fixed" in $$new_props) $$invalidate(0, fixed = $$new_props.fixed);
    		if ("open" in $$new_props) $$invalidate(8, open = $$new_props.open);
    		if ("quickOpen" in $$new_props) $$invalidate(11, quickOpen = $$new_props.quickOpen);
    		if ("anchorElement" in $$new_props) $$invalidate(9, anchorElement = $$new_props.anchorElement);
    		if ("anchorCorner" in $$new_props) $$invalidate(12, anchorCorner = $$new_props.anchorCorner);
    		if ("element" in $$new_props) $$invalidate(1, element = $$new_props.element);
    		if ("$$scope" in $$new_props) $$invalidate(26, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			isStatic,
    			anchor,
    			fixed,
    			open,
    			quickOpen,
    			anchorElement,
    			anchorCorner,
    			element,
    			menuSurface,
    			instantiate,
    			getInstance,
    			oldFixed
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(7, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(2, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(3, className = $$new_props.className);
    		if ("isStatic" in $$props) $$invalidate(4, isStatic = $$new_props.isStatic);
    		if ("anchor" in $$props) $$invalidate(10, anchor = $$new_props.anchor);
    		if ("fixed" in $$props) $$invalidate(0, fixed = $$new_props.fixed);
    		if ("open" in $$props) $$invalidate(8, open = $$new_props.open);
    		if ("quickOpen" in $$props) $$invalidate(11, quickOpen = $$new_props.quickOpen);
    		if ("anchorElement" in $$props) $$invalidate(9, anchorElement = $$new_props.anchorElement);
    		if ("anchorCorner" in $$props) $$invalidate(12, anchorCorner = $$new_props.anchorCorner);
    		if ("element" in $$props) $$invalidate(1, element = $$new_props.element);
    		if ("menuSurface" in $$props) $$invalidate(22, menuSurface = $$new_props.menuSurface);
    		if ("instantiate" in $$props) instantiate = $$new_props.instantiate;
    		if ("getInstance" in $$props) getInstance = $$new_props.getInstance;
    		if ("oldFixed" in $$props) $$invalidate(23, oldFixed = $$new_props.oldFixed);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*element, anchor*/ 1026) {
    			 if (element && anchor && !element.parentNode.classList.contains("mdc-menu-surface--anchor")) {
    				element.parentNode.classList.add("mdc-menu-surface--anchor");
    				$$invalidate(9, anchorElement = element.parentNode);
    			}
    		}

    		if ($$self.$$.dirty & /*menuSurface, quickOpen*/ 4196352) {
    			 if (menuSurface && menuSurface.quickOpen !== quickOpen) {
    				$$invalidate(22, menuSurface.quickOpen = quickOpen, menuSurface);
    			}
    		}

    		if ($$self.$$.dirty & /*menuSurface, anchorElement*/ 4194816) {
    			 if (menuSurface && menuSurface.anchorElement !== anchorElement) {
    				$$invalidate(22, menuSurface.anchorElement = anchorElement, menuSurface);
    			}
    		}

    		if ($$self.$$.dirty & /*menuSurface, open*/ 4194560) {
    			 if (menuSurface && menuSurface.isOpen() !== open) {
    				if (open) {
    					menuSurface.open();
    				} else {
    					menuSurface.close();
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*menuSurface, oldFixed, fixed*/ 12582913) {
    			 if (menuSurface && oldFixed !== fixed) {
    				menuSurface.setFixedPosition(fixed);
    				$$invalidate(23, oldFixed = fixed);
    			}
    		}

    		if ($$self.$$.dirty & /*menuSurface, anchorCorner*/ 4198400) {
    			 if (menuSurface && anchorCorner != null) {
    				if (Corner.hasOwnProperty(anchorCorner)) {
    					menuSurface.setAnchorCorner(Corner[anchorCorner]);
    				} else if (CornerBit.hasOwnProperty(anchorCorner)) {
    					menuSurface.setAnchorCorner(Corner[anchorCorner]);
    				} else {
    					menuSurface.setAnchorCorner(anchorCorner);
    				}
    			}
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		fixed,
    		element,
    		use,
    		className,
    		isStatic,
    		forwardEvents,
    		updateOpen,
    		$$props,
    		open,
    		anchorElement,
    		anchor,
    		quickOpen,
    		anchorCorner,
    		setOpen,
    		setAnchorCorner,
    		setAnchorMargin,
    		setFixedPosition,
    		setAbsolutePosition,
    		setMenuSurfaceAnchorElement,
    		hoistMenuToBody,
    		setIsHoisted,
    		getDefaultFoundation,
    		menuSurface,
    		oldFixed,
    		instantiate,
    		getInstance,
    		$$scope,
    		$$slots,
    		div_binding
    	];
    }

    class MenuSurface extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			use: 2,
    			class: 3,
    			static: 4,
    			anchor: 10,
    			fixed: 0,
    			open: 8,
    			quickOpen: 11,
    			anchorElement: 9,
    			anchorCorner: 12,
    			element: 1,
    			setOpen: 13,
    			setAnchorCorner: 14,
    			setAnchorMargin: 15,
    			setFixedPosition: 16,
    			setAbsolutePosition: 17,
    			setMenuSurfaceAnchorElement: 18,
    			hoistMenuToBody: 19,
    			setIsHoisted: 20,
    			getDefaultFoundation: 21
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuSurface",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get use() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get static() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set static(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get anchor() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set anchor(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fixed() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fixed(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get open() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set open(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get quickOpen() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set quickOpen(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get anchorElement() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set anchorElement(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get anchorCorner() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set anchorCorner(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get element() {
    		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set element(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setOpen() {
    		return this.$$.ctx[13];
    	}

    	set setOpen(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setAnchorCorner() {
    		return this.$$.ctx[14];
    	}

    	set setAnchorCorner(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setAnchorMargin() {
    		return this.$$.ctx[15];
    	}

    	set setAnchorMargin(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setFixedPosition() {
    		return this.$$.ctx[16];
    	}

    	set setFixedPosition(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setAbsolutePosition() {
    		return this.$$.ctx[17];
    	}

    	set setAbsolutePosition(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setMenuSurfaceAnchorElement() {
    		return this.$$.ctx[18];
    	}

    	set setMenuSurfaceAnchorElement(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get hoistMenuToBody() {
    		return this.$$.ctx[19];
    	}

    	set hoistMenuToBody(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setIsHoisted() {
    		return this.$$.ctx[20];
    	}

    	set setIsHoisted(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getDefaultFoundation() {
    		return this.$$.ctx[21];
    	}

    	set getDefaultFoundation(value) {
    		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/menu/Menu.svelte generated by Svelte v3.16.0 */

    // (1:0) <MenuSurface   bind:element   use={[forwardEvents, ...use]}   class="mdc-menu {className}"   on:MDCMenu:selected={updateOpen}   on:MDCMenuSurface:closed={updateOpen} on:MDCMenuSurface:opened={updateOpen}   {...exclude($$props, ['use', 'class', 'wrapFocus'])} >
    function create_default_slot(ctx) {
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[34].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[36], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty[1] & /*$$scope*/ 32) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[36], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[36], dirty, null));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(1:0) <MenuSurface   bind:element   use={[forwardEvents, ...use]}   class=\\\"mdc-menu {className}\\\"   on:MDCMenu:selected={updateOpen}   on:MDCMenuSurface:closed={updateOpen} on:MDCMenuSurface:opened={updateOpen}   {...exclude($$props, ['use', 'class', 'wrapFocus'])} >",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let updating_element;
    	let current;

    	const menusurface_spread_levels = [
    		{
    			use: [/*forwardEvents*/ ctx[3], .../*use*/ ctx[0]]
    		},
    		{
    			class: "mdc-menu " + /*className*/ ctx[1]
    		},
    		exclude(/*$$props*/ ctx[5], ["use", "class", "wrapFocus"])
    	];

    	function menusurface_element_binding(value) {
    		/*menusurface_element_binding*/ ctx[35].call(null, value);
    	}

    	let menusurface_props = {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < menusurface_spread_levels.length; i += 1) {
    		menusurface_props = assign(menusurface_props, menusurface_spread_levels[i]);
    	}

    	if (/*element*/ ctx[2] !== void 0) {
    		menusurface_props.element = /*element*/ ctx[2];
    	}

    	const menusurface = new MenuSurface({ props: menusurface_props, $$inline: true });
    	binding_callbacks.push(() => bind(menusurface, "element", menusurface_element_binding));
    	menusurface.$on("MDCMenu:selected", /*updateOpen*/ ctx[4]);
    	menusurface.$on("MDCMenuSurface:closed", /*updateOpen*/ ctx[4]);
    	menusurface.$on("MDCMenuSurface:opened", /*updateOpen*/ ctx[4]);

    	const block = {
    		c: function create() {
    			create_component(menusurface.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(menusurface, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const menusurface_changes = dirty[0] & /*forwardEvents, use, className, $$props*/ 43
    			? get_spread_update(menusurface_spread_levels, [
    					dirty[0] & /*forwardEvents, use*/ 9 && ({
    						use: [/*forwardEvents*/ ctx[3], .../*use*/ ctx[0]]
    					}),
    					dirty[0] & /*className*/ 2 && ({
    						class: "mdc-menu " + /*className*/ ctx[1]
    					}),
    					dirty[0] & /*$$props*/ 32 && get_spread_object(exclude(/*$$props*/ ctx[5], ["use", "class", "wrapFocus"]))
    				])
    			: {};

    			if (dirty[1] & /*$$scope*/ 32) {
    				menusurface_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_element && dirty[0] & /*element*/ 4) {
    				updating_element = true;
    				menusurface_changes.element = /*element*/ ctx[2];
    				add_flush_callback(() => updating_element = false);
    			}

    			menusurface.$set(menusurface_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menusurface.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menusurface.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menusurface, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component, ["MDCMenu:selected", "MDCMenuSurface:closed", "MDCMenuSurface:opened"]);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { static: isStatic = false } = $$props;
    	let { open = isStatic } = $$props;
    	let { quickOpen = false } = $$props;
    	let { anchorCorner = null } = $$props;
    	let { wrapFocus = false } = $$props;
    	let element;
    	let menu;
    	let instantiate = getContext("SMUI:menu:instantiate");
    	let getInstance = getContext("SMUI:menu:getInstance");
    	let menuSurfacePromiseResolve;
    	let menuSurfacePromise = new Promise(resolve => menuSurfacePromiseResolve = resolve);
    	let listPromiseResolve;
    	let listPromise = new Promise(resolve => listPromiseResolve = resolve);
    	setContext("SMUI:menu-surface:instantiate", false);
    	setContext("SMUI:menu-surface:getInstance", getMenuSurfaceInstancePromise);
    	setContext("SMUI:list:instantiate", false);
    	setContext("SMUI:list:getInstance", getListInstancePromise);

    	onMount(async () => {
    		if (instantiate !== false) {
    			$$invalidate(25, menu = new MDCMenu(element));
    		} else {
    			$$invalidate(25, menu = await getInstance());
    		}

    		menuSurfacePromiseResolve(menu.menuSurface_);
    		listPromiseResolve(menu.list_);
    	});

    	onDestroy(() => {
    		if (instantiate !== false) {
    			menu && menu.destroy();
    		}
    	});

    	function getMenuSurfaceInstancePromise() {
    		return menuSurfacePromise;
    	}

    	function getListInstancePromise() {
    		return listPromise;
    	}

    	function updateOpen() {
    		$$invalidate(6, open = menu.open);
    	}

    	function setOpen(value) {
    		$$invalidate(6, open = value);
    	}

    	function getItems() {
    		return menu.items;
    	}

    	function setDefaultFocusState(...args) {
    		return menu.setDefaultFocusState(...args);
    	}

    	function setAnchorCorner(...args) {
    		return menu.setAnchorCorner(...args);
    	}

    	function setAnchorMargin(...args) {
    		return menu.setAnchorMargin(...args);
    	}

    	function setSelectedIndex(...args) {
    		return menu.setSelectedIndex(...args);
    	}

    	function setEnabled(...args) {
    		return menu.setEnabled(...args);
    	}

    	function getOptionByIndex(...args) {
    		return menu.getOptionByIndex(...args);
    	}

    	function setFixedPosition(...args) {
    		return menu.setFixedPosition(...args);
    	}

    	function hoistMenuToBody(...args) {
    		return menu.hoistMenuToBody(...args);
    	}

    	function setIsHoisted(...args) {
    		return menu.setIsHoisted(...args);
    	}

    	function setAbsolutePosition(...args) {
    		return menu.setAbsolutePosition(...args);
    	}

    	function setAnchorElement(...args) {
    		return menu.setAnchorElement(...args);
    	}

    	function getDefaultFoundation(...args) {
    		return menu.getDefaultFoundation(...args);
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function menusurface_element_binding(value) {
    		element = value;
    		$$invalidate(2, element);
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("static" in $$new_props) $$invalidate(7, isStatic = $$new_props.static);
    		if ("open" in $$new_props) $$invalidate(6, open = $$new_props.open);
    		if ("quickOpen" in $$new_props) $$invalidate(8, quickOpen = $$new_props.quickOpen);
    		if ("anchorCorner" in $$new_props) $$invalidate(9, anchorCorner = $$new_props.anchorCorner);
    		if ("wrapFocus" in $$new_props) $$invalidate(10, wrapFocus = $$new_props.wrapFocus);
    		if ("$$scope" in $$new_props) $$invalidate(36, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			isStatic,
    			open,
    			quickOpen,
    			anchorCorner,
    			wrapFocus,
    			element,
    			menu,
    			instantiate,
    			getInstance,
    			menuSurfacePromiseResolve,
    			menuSurfacePromise,
    			listPromiseResolve,
    			listPromise
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("isStatic" in $$props) $$invalidate(7, isStatic = $$new_props.isStatic);
    		if ("open" in $$props) $$invalidate(6, open = $$new_props.open);
    		if ("quickOpen" in $$props) $$invalidate(8, quickOpen = $$new_props.quickOpen);
    		if ("anchorCorner" in $$props) $$invalidate(9, anchorCorner = $$new_props.anchorCorner);
    		if ("wrapFocus" in $$props) $$invalidate(10, wrapFocus = $$new_props.wrapFocus);
    		if ("element" in $$props) $$invalidate(2, element = $$new_props.element);
    		if ("menu" in $$props) $$invalidate(25, menu = $$new_props.menu);
    		if ("instantiate" in $$props) instantiate = $$new_props.instantiate;
    		if ("getInstance" in $$props) getInstance = $$new_props.getInstance;
    		if ("menuSurfacePromiseResolve" in $$props) menuSurfacePromiseResolve = $$new_props.menuSurfacePromiseResolve;
    		if ("menuSurfacePromise" in $$props) menuSurfacePromise = $$new_props.menuSurfacePromise;
    		if ("listPromiseResolve" in $$props) listPromiseResolve = $$new_props.listPromiseResolve;
    		if ("listPromise" in $$props) listPromise = $$new_props.listPromise;
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*menu, open, isStatic*/ 33554624) {
    			 if (menu && menu.open !== open) {
    				if (isStatic) {
    					$$invalidate(6, open = true);
    				}

    				$$invalidate(25, menu.open = open, menu);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*menu, wrapFocus*/ 33555456) {
    			 if (menu && menu.wrapFocus !== wrapFocus) {
    				$$invalidate(25, menu.wrapFocus = wrapFocus, menu);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*menu, quickOpen*/ 33554688) {
    			 if (menu) {
    				$$invalidate(25, menu.quickOpen = quickOpen, menu);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*menu, anchorCorner*/ 33554944) {
    			 if (menu && anchorCorner != null) {
    				if (Corner.hasOwnProperty(anchorCorner)) {
    					menu.setAnchorCorner(Corner[anchorCorner]);
    				} else if (CornerBit.hasOwnProperty(anchorCorner)) {
    					menu.setAnchorCorner(Corner[anchorCorner]);
    				} else {
    					menu.setAnchorCorner(anchorCorner);
    				}
    			}
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		element,
    		forwardEvents,
    		updateOpen,
    		$$props,
    		open,
    		isStatic,
    		quickOpen,
    		anchorCorner,
    		wrapFocus,
    		setOpen,
    		getItems,
    		setDefaultFocusState,
    		setAnchorCorner,
    		setAnchorMargin,
    		setSelectedIndex,
    		setEnabled,
    		getOptionByIndex,
    		setFixedPosition,
    		hoistMenuToBody,
    		setIsHoisted,
    		setAbsolutePosition,
    		setAnchorElement,
    		getDefaultFoundation,
    		menu,
    		menuSurfacePromiseResolve,
    		listPromiseResolve,
    		instantiate,
    		getInstance,
    		menuSurfacePromise,
    		listPromise,
    		getMenuSurfaceInstancePromise,
    		getListInstancePromise,
    		$$slots,
    		menusurface_element_binding,
    		$$scope
    	];
    }

    class Menu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$7,
    			create_fragment$7,
    			safe_not_equal,
    			{
    				use: 0,
    				class: 1,
    				static: 7,
    				open: 6,
    				quickOpen: 8,
    				anchorCorner: 9,
    				wrapFocus: 10,
    				setOpen: 11,
    				getItems: 12,
    				setDefaultFocusState: 13,
    				setAnchorCorner: 14,
    				setAnchorMargin: 15,
    				setSelectedIndex: 16,
    				setEnabled: 17,
    				getOptionByIndex: 18,
    				setFixedPosition: 19,
    				hoistMenuToBody: 20,
    				setIsHoisted: 21,
    				setAbsolutePosition: 22,
    				setAnchorElement: 23,
    				getDefaultFoundation: 24
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get use() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get static() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set static(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get open() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set open(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get quickOpen() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set quickOpen(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get anchorCorner() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set anchorCorner(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get wrapFocus() {
    		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set wrapFocus(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setOpen() {
    		return this.$$.ctx[11];
    	}

    	set setOpen(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getItems() {
    		return this.$$.ctx[12];
    	}

    	set getItems(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setDefaultFocusState() {
    		return this.$$.ctx[13];
    	}

    	set setDefaultFocusState(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setAnchorCorner() {
    		return this.$$.ctx[14];
    	}

    	set setAnchorCorner(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setAnchorMargin() {
    		return this.$$.ctx[15];
    	}

    	set setAnchorMargin(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setSelectedIndex() {
    		return this.$$.ctx[16];
    	}

    	set setSelectedIndex(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setEnabled() {
    		return this.$$.ctx[17];
    	}

    	set setEnabled(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getOptionByIndex() {
    		return this.$$.ctx[18];
    	}

    	set getOptionByIndex(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setFixedPosition() {
    		return this.$$.ctx[19];
    	}

    	set setFixedPosition(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get hoistMenuToBody() {
    		return this.$$.ctx[20];
    	}

    	set hoistMenuToBody(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setIsHoisted() {
    		return this.$$.ctx[21];
    	}

    	set setIsHoisted(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setAbsolutePosition() {
    		return this.$$.ctx[22];
    	}

    	set setAbsolutePosition(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setAnchorElement() {
    		return this.$$.ctx[23];
    	}

    	set setAnchorElement(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getDefaultFoundation() {
    		return this.$$.ctx[24];
    	}

    	set getDefaultFoundation(value) {
    		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/list/List.svelte generated by Svelte v3.16.0 */
    const file$5 = "node_modules/@smui/list/List.svelte";

    // (15:0) {:else}
    function create_else_block$2(ctx) {
    	let ul;
    	let forwardEvents_action;
    	let useActions_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[29].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[28], null);

    	let ul_levels = [
    		/*props*/ ctx[9],
    		{
    			class: "mdc-list " + /*className*/ ctx[1]
    		},
    		{ role: /*role*/ ctx[8] }
    	];

    	let ul_data = {};

    	for (let i = 0; i < ul_levels.length; i += 1) {
    		ul_data = assign(ul_data, ul_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");
    			if (default_slot) default_slot.c();
    			set_attributes(ul, ul_data);
    			toggle_class(ul, "mdc-list--avatar-list", /*avatarList*/ ctx[4]);
    			toggle_class(ul, "mdc-list--non-interactive", /*nonInteractive*/ ctx[2]);
    			toggle_class(ul, "mdc-list--dense", /*dense*/ ctx[3]);
    			toggle_class(ul, "mdc-list--two-line", /*twoLine*/ ctx[5]);
    			toggle_class(ul, "smui-list--three-line", /*threeLine*/ ctx[6] && !/*twoLine*/ ctx[5]);
    			add_location(ul, file$5, 15, 2, 433);
    			dispose = listen_dev(ul, "MDCList:action", /*handleAction*/ ctx[12], false, false, false);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			if (default_slot) {
    				default_slot.m(ul, null);
    			}

    			/*ul_binding*/ ctx[31](ul);
    			forwardEvents_action = /*forwardEvents*/ ctx[10].call(null, ul) || ({});
    			useActions_action = useActions.call(null, ul, /*use*/ ctx[0]) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 268435456) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[28], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[28], dirty, null));
    			}

    			set_attributes(ul, get_spread_update(ul_levels, [
    				dirty & /*props*/ 512 && /*props*/ ctx[9],
    				dirty & /*className*/ 2 && ({
    					class: "mdc-list " + /*className*/ ctx[1]
    				}),
    				dirty & /*role*/ 256 && ({ role: /*role*/ ctx[8] })
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			toggle_class(ul, "mdc-list--avatar-list", /*avatarList*/ ctx[4]);
    			toggle_class(ul, "mdc-list--non-interactive", /*nonInteractive*/ ctx[2]);
    			toggle_class(ul, "mdc-list--dense", /*dense*/ ctx[3]);
    			toggle_class(ul, "mdc-list--two-line", /*twoLine*/ ctx[5]);
    			toggle_class(ul, "smui-list--three-line", /*threeLine*/ ctx[6] && !/*twoLine*/ ctx[5]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			if (default_slot) default_slot.d(detaching);
    			/*ul_binding*/ ctx[31](null);
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(15:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (1:0) {#if nav}
    function create_if_block$2(ctx) {
    	let nav_1;
    	let forwardEvents_action;
    	let useActions_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[29].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[28], null);

    	let nav_1_levels = [
    		/*props*/ ctx[9],
    		{
    			class: "mdc-list " + /*className*/ ctx[1]
    		}
    	];

    	let nav_1_data = {};

    	for (let i = 0; i < nav_1_levels.length; i += 1) {
    		nav_1_data = assign(nav_1_data, nav_1_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			nav_1 = element("nav");
    			if (default_slot) default_slot.c();
    			set_attributes(nav_1, nav_1_data);
    			toggle_class(nav_1, "mdc-list--dense", /*dense*/ ctx[3]);
    			toggle_class(nav_1, "mdc-list--non-interactive", /*nonInteractive*/ ctx[2]);
    			toggle_class(nav_1, "mdc-list--avatar-list", /*avatarList*/ ctx[4]);
    			toggle_class(nav_1, "mdc-list--two-line", /*twoLine*/ ctx[5]);
    			toggle_class(nav_1, "smui-list--three-line", /*threeLine*/ ctx[6] && !/*twoLine*/ ctx[5]);
    			add_location(nav_1, file$5, 1, 2, 12);
    			dispose = listen_dev(nav_1, "MDCList:action", /*handleAction*/ ctx[12], false, false, false);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav_1, anchor);

    			if (default_slot) {
    				default_slot.m(nav_1, null);
    			}

    			/*nav_1_binding*/ ctx[30](nav_1);
    			forwardEvents_action = /*forwardEvents*/ ctx[10].call(null, nav_1) || ({});
    			useActions_action = useActions.call(null, nav_1, /*use*/ ctx[0]) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 268435456) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[28], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[28], dirty, null));
    			}

    			set_attributes(nav_1, get_spread_update(nav_1_levels, [
    				dirty & /*props*/ 512 && /*props*/ ctx[9],
    				dirty & /*className*/ 2 && ({
    					class: "mdc-list " + /*className*/ ctx[1]
    				})
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			toggle_class(nav_1, "mdc-list--dense", /*dense*/ ctx[3]);
    			toggle_class(nav_1, "mdc-list--non-interactive", /*nonInteractive*/ ctx[2]);
    			toggle_class(nav_1, "mdc-list--avatar-list", /*avatarList*/ ctx[4]);
    			toggle_class(nav_1, "mdc-list--two-line", /*twoLine*/ ctx[5]);
    			toggle_class(nav_1, "smui-list--three-line", /*threeLine*/ ctx[6] && !/*twoLine*/ ctx[5]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav_1);
    			if (default_slot) default_slot.d(detaching);
    			/*nav_1_binding*/ ctx[30](null);
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(1:0) {#if nav}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$2, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*nav*/ ctx[11]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component, ["MDCList:action"]);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { nonInteractive = false } = $$props;
    	let { dense = false } = $$props;
    	let { avatarList = false } = $$props;
    	let { twoLine = false } = $$props;
    	let { threeLine = false } = $$props;
    	let { vertical = true } = $$props;
    	let { wrapFocus = false } = $$props;
    	let { singleSelection = false } = $$props;
    	let { selectedIndex = null } = $$props;
    	let { radiolist = false } = $$props;
    	let { checklist = false } = $$props;
    	let element;
    	let list;
    	let role = getContext("SMUI:list:role");
    	let nav = getContext("SMUI:list:nav");
    	let instantiate = getContext("SMUI:list:instantiate");
    	let getInstance = getContext("SMUI:list:getInstance");
    	let addLayoutListener = getContext("SMUI:addLayoutListener");
    	let removeLayoutListener;
    	setContext("SMUI:list:nonInteractive", nonInteractive);

    	if (!role) {
    		if (singleSelection) {
    			$$invalidate(8, role = "listbox");
    			setContext("SMUI:list:item:role", "option");
    		} else if (radiolist) {
    			$$invalidate(8, role = "radiogroup");
    			setContext("SMUI:list:item:role", "radio");
    		} else if (checklist) {
    			$$invalidate(8, role = "group");
    			setContext("SMUI:list:item:role", "checkbox");
    		} else {
    			$$invalidate(8, role = "list");
    			setContext("SMUI:list:item:role", undefined);
    		}
    	}

    	if (addLayoutListener) {
    		removeLayoutListener = addLayoutListener(layout);
    	}

    	onMount(async () => {
    		if (instantiate !== false) {
    			$$invalidate(22, list = new MDCList(element));
    		} else {
    			$$invalidate(22, list = await getInstance());
    		}

    		if (singleSelection) {
    			list.initializeListType();
    			$$invalidate(13, selectedIndex = list.selectedIndex);
    		}
    	});

    	onDestroy(() => {
    		if (instantiate !== false) {
    			list && list.destroy();
    		}

    		if (removeLayoutListener) {
    			removeLayoutListener();
    		}
    	});

    	function handleAction(e) {
    		if (list && list.listElements[e.detail.index].classList.contains("mdc-list-item--disabled")) {
    			e.preventDefault();
    			$$invalidate(22, list.selectedIndex = selectedIndex, list);
    		} else if (list && list.selectedIndex === e.detail.index) {
    			$$invalidate(13, selectedIndex = e.detail.index);
    		}
    	}

    	function layout(...args) {
    		return list.layout(...args);
    	}

    	function setEnabled(...args) {
    		return list.setEnabled(...args);
    	}

    	function getDefaultFoundation(...args) {
    		return list.getDefaultFoundation(...args);
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function nav_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(7, element = $$value);
    		});
    	}

    	function ul_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(7, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(27, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("nonInteractive" in $$new_props) $$invalidate(2, nonInteractive = $$new_props.nonInteractive);
    		if ("dense" in $$new_props) $$invalidate(3, dense = $$new_props.dense);
    		if ("avatarList" in $$new_props) $$invalidate(4, avatarList = $$new_props.avatarList);
    		if ("twoLine" in $$new_props) $$invalidate(5, twoLine = $$new_props.twoLine);
    		if ("threeLine" in $$new_props) $$invalidate(6, threeLine = $$new_props.threeLine);
    		if ("vertical" in $$new_props) $$invalidate(14, vertical = $$new_props.vertical);
    		if ("wrapFocus" in $$new_props) $$invalidate(15, wrapFocus = $$new_props.wrapFocus);
    		if ("singleSelection" in $$new_props) $$invalidate(16, singleSelection = $$new_props.singleSelection);
    		if ("selectedIndex" in $$new_props) $$invalidate(13, selectedIndex = $$new_props.selectedIndex);
    		if ("radiolist" in $$new_props) $$invalidate(17, radiolist = $$new_props.radiolist);
    		if ("checklist" in $$new_props) $$invalidate(18, checklist = $$new_props.checklist);
    		if ("$$scope" in $$new_props) $$invalidate(28, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			nonInteractive,
    			dense,
    			avatarList,
    			twoLine,
    			threeLine,
    			vertical,
    			wrapFocus,
    			singleSelection,
    			selectedIndex,
    			radiolist,
    			checklist,
    			element,
    			list,
    			role,
    			nav,
    			instantiate,
    			getInstance,
    			addLayoutListener,
    			removeLayoutListener,
    			props
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(27, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("nonInteractive" in $$props) $$invalidate(2, nonInteractive = $$new_props.nonInteractive);
    		if ("dense" in $$props) $$invalidate(3, dense = $$new_props.dense);
    		if ("avatarList" in $$props) $$invalidate(4, avatarList = $$new_props.avatarList);
    		if ("twoLine" in $$props) $$invalidate(5, twoLine = $$new_props.twoLine);
    		if ("threeLine" in $$props) $$invalidate(6, threeLine = $$new_props.threeLine);
    		if ("vertical" in $$props) $$invalidate(14, vertical = $$new_props.vertical);
    		if ("wrapFocus" in $$props) $$invalidate(15, wrapFocus = $$new_props.wrapFocus);
    		if ("singleSelection" in $$props) $$invalidate(16, singleSelection = $$new_props.singleSelection);
    		if ("selectedIndex" in $$props) $$invalidate(13, selectedIndex = $$new_props.selectedIndex);
    		if ("radiolist" in $$props) $$invalidate(17, radiolist = $$new_props.radiolist);
    		if ("checklist" in $$props) $$invalidate(18, checklist = $$new_props.checklist);
    		if ("element" in $$props) $$invalidate(7, element = $$new_props.element);
    		if ("list" in $$props) $$invalidate(22, list = $$new_props.list);
    		if ("role" in $$props) $$invalidate(8, role = $$new_props.role);
    		if ("nav" in $$props) $$invalidate(11, nav = $$new_props.nav);
    		if ("instantiate" in $$props) instantiate = $$new_props.instantiate;
    		if ("getInstance" in $$props) getInstance = $$new_props.getInstance;
    		if ("addLayoutListener" in $$props) addLayoutListener = $$new_props.addLayoutListener;
    		if ("removeLayoutListener" in $$props) removeLayoutListener = $$new_props.removeLayoutListener;
    		if ("props" in $$props) $$invalidate(9, props = $$new_props.props);
    	};

    	let props;

    	$$self.$$.update = () => {
    		 $$invalidate(9, props = exclude($$props, [
    			"use",
    			"class",
    			"nonInteractive",
    			"dense",
    			"avatarList",
    			"twoLine",
    			"threeLine",
    			"vertical",
    			"wrapFocus",
    			"singleSelection",
    			"selectedIndex",
    			"radiolist",
    			"checklist"
    		]));

    		if ($$self.$$.dirty & /*list, vertical*/ 4210688) {
    			 if (list && list.vertical !== vertical) {
    				$$invalidate(22, list.vertical = vertical, list);
    			}
    		}

    		if ($$self.$$.dirty & /*list, wrapFocus*/ 4227072) {
    			 if (list && list.wrapFocus !== wrapFocus) {
    				$$invalidate(22, list.wrapFocus = wrapFocus, list);
    			}
    		}

    		if ($$self.$$.dirty & /*list, singleSelection*/ 4259840) {
    			 if (list && list.singleSelection !== singleSelection) {
    				$$invalidate(22, list.singleSelection = singleSelection, list);
    			}
    		}

    		if ($$self.$$.dirty & /*list, singleSelection, selectedIndex*/ 4268032) {
    			 if (list && singleSelection && list.selectedIndex !== selectedIndex) {
    				$$invalidate(22, list.selectedIndex = selectedIndex, list);
    			}
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		nonInteractive,
    		dense,
    		avatarList,
    		twoLine,
    		threeLine,
    		element,
    		role,
    		props,
    		forwardEvents,
    		nav,
    		handleAction,
    		selectedIndex,
    		vertical,
    		wrapFocus,
    		singleSelection,
    		radiolist,
    		checklist,
    		layout,
    		setEnabled,
    		getDefaultFoundation,
    		list,
    		removeLayoutListener,
    		instantiate,
    		getInstance,
    		addLayoutListener,
    		$$props,
    		$$scope,
    		$$slots,
    		nav_1_binding,
    		ul_binding
    	];
    }

    class List extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
    			use: 0,
    			class: 1,
    			nonInteractive: 2,
    			dense: 3,
    			avatarList: 4,
    			twoLine: 5,
    			threeLine: 6,
    			vertical: 14,
    			wrapFocus: 15,
    			singleSelection: 16,
    			selectedIndex: 13,
    			radiolist: 17,
    			checklist: 18,
    			layout: 19,
    			setEnabled: 20,
    			getDefaultFoundation: 21
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "List",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get use() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nonInteractive() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nonInteractive(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dense() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dense(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get avatarList() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set avatarList(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get twoLine() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set twoLine(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get threeLine() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set threeLine(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vertical() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vertical(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get wrapFocus() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set wrapFocus(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get singleSelection() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set singleSelection(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedIndex() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedIndex(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get radiolist() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set radiolist(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get checklist() {
    		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checklist(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get layout() {
    		return this.$$.ctx[19];
    	}

    	set layout(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setEnabled() {
    		return this.$$.ctx[20];
    	}

    	set setEnabled(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getDefaultFoundation() {
    		return this.$$.ctx[21];
    	}

    	set getDefaultFoundation(value) {
    		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/floating-label/FloatingLabel.svelte generated by Svelte v3.16.0 */
    const file$6 = "node_modules/@smui/floating-label/FloatingLabel.svelte";

    // (9:0) {:else}
    function create_else_block$3(ctx) {
    	let label;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[14].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[13], null);

    	let label_levels = [
    		{
    			class: "mdc-floating-label " + /*className*/ ctx[1]
    		},
    		/*forProp*/ ctx[4],
    		exclude(/*$$props*/ ctx[6], ["use", "class", "for", "wrapped"])
    	];

    	let label_data = {};

    	for (let i = 0; i < label_levels.length; i += 1) {
    		label_data = assign(label_data, label_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			label = element("label");
    			if (default_slot) default_slot.c();
    			set_attributes(label, label_data);
    			add_location(label, file$6, 9, 2, 225);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);

    			if (default_slot) {
    				default_slot.m(label, null);
    			}

    			/*label_binding*/ ctx[16](label);
    			useActions_action = useActions.call(null, label, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[5].call(null, label) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8192) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[13], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[13], dirty, null));
    			}

    			set_attributes(label, get_spread_update(label_levels, [
    				dirty & /*className*/ 2 && ({
    					class: "mdc-floating-label " + /*className*/ ctx[1]
    				}),
    				dirty & /*forProp*/ 16 && /*forProp*/ ctx[4],
    				dirty & /*exclude, $$props*/ 64 && exclude(/*$$props*/ ctx[6], ["use", "class", "for", "wrapped"])
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			if (default_slot) default_slot.d(detaching);
    			/*label_binding*/ ctx[16](null);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(9:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (1:0) {#if wrapped}
    function create_if_block$3(ctx) {
    	let span;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[14].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[13], null);

    	let span_levels = [
    		{
    			class: "mdc-floating-label " + /*className*/ ctx[1]
    		},
    		exclude(/*$$props*/ ctx[6], ["use", "class", "wrapped"])
    	];

    	let span_data = {};

    	for (let i = 0; i < span_levels.length; i += 1) {
    		span_data = assign(span_data, span_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			span = element("span");
    			if (default_slot) default_slot.c();
    			set_attributes(span, span_data);
    			add_location(span, file$6, 1, 2, 16);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);

    			if (default_slot) {
    				default_slot.m(span, null);
    			}

    			/*span_binding*/ ctx[15](span);
    			useActions_action = useActions.call(null, span, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[5].call(null, span) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8192) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[13], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[13], dirty, null));
    			}

    			set_attributes(span, get_spread_update(span_levels, [
    				dirty & /*className*/ 2 && ({
    					class: "mdc-floating-label " + /*className*/ ctx[1]
    				}),
    				dirty & /*exclude, $$props*/ 64 && exclude(/*$$props*/ ctx[6], ["use", "class", "wrapped"])
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (default_slot) default_slot.d(detaching);
    			/*span_binding*/ ctx[15](null);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(1:0) {#if wrapped}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$3, create_else_block$3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*wrapped*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { for: forId = "" } = $$props;
    	let { wrapped = false } = $$props;
    	let element;
    	let floatingLabel;
    	let inputProps = getContext("SMUI:generic:input:props") || ({});

    	onMount(() => {
    		floatingLabel = new MDCFloatingLabel(element);
    	});

    	onDestroy(() => {
    		floatingLabel && floatingLabel.destroy();
    	});

    	function shake(shouldShake, ...args) {
    		return floatingLabel.shake(shouldShake, ...args);
    	}

    	function float(shouldFloat, ...args) {
    		return floatingLabel.float(shouldFloat, ...args);
    	}

    	function getWidth(...args) {
    		return floatingLabel.getWidth(...args);
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function span_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(3, element = $$value);
    		});
    	}

    	function label_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(3, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(6, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("for" in $$new_props) $$invalidate(7, forId = $$new_props.for);
    		if ("wrapped" in $$new_props) $$invalidate(2, wrapped = $$new_props.wrapped);
    		if ("$$scope" in $$new_props) $$invalidate(13, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			forId,
    			wrapped,
    			element,
    			floatingLabel,
    			inputProps,
    			forProp
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(6, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("forId" in $$props) $$invalidate(7, forId = $$new_props.forId);
    		if ("wrapped" in $$props) $$invalidate(2, wrapped = $$new_props.wrapped);
    		if ("element" in $$props) $$invalidate(3, element = $$new_props.element);
    		if ("floatingLabel" in $$props) floatingLabel = $$new_props.floatingLabel;
    		if ("inputProps" in $$props) $$invalidate(12, inputProps = $$new_props.inputProps);
    		if ("forProp" in $$props) $$invalidate(4, forProp = $$new_props.forProp);
    	};

    	let forProp;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*forId*/ 128) {
    			 $$invalidate(4, forProp = forId || inputProps && inputProps.id
    			? {
    					for: forId || inputProps && inputProps.id
    				}
    			: {});
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		wrapped,
    		element,
    		forProp,
    		forwardEvents,
    		$$props,
    		forId,
    		shake,
    		float,
    		getWidth,
    		floatingLabel,
    		inputProps,
    		$$scope,
    		$$slots,
    		span_binding,
    		label_binding
    	];
    }

    class FloatingLabel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
    			use: 0,
    			class: 1,
    			for: 7,
    			wrapped: 2,
    			shake: 8,
    			float: 9,
    			getWidth: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FloatingLabel",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get use() {
    		throw new Error("<FloatingLabel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<FloatingLabel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<FloatingLabel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<FloatingLabel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get for() {
    		throw new Error("<FloatingLabel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set for(value) {
    		throw new Error("<FloatingLabel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get wrapped() {
    		throw new Error("<FloatingLabel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set wrapped(value) {
    		throw new Error("<FloatingLabel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get shake() {
    		return this.$$.ctx[8];
    	}

    	set shake(value) {
    		throw new Error("<FloatingLabel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get float() {
    		return this.$$.ctx[9];
    	}

    	set float(value) {
    		throw new Error("<FloatingLabel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getWidth() {
    		return this.$$.ctx[10];
    	}

    	set getWidth(value) {
    		throw new Error("<FloatingLabel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/line-ripple/LineRipple.svelte generated by Svelte v3.16.0 */
    const file$7 = "node_modules/@smui/line-ripple/LineRipple.svelte";

    function create_fragment$a(ctx) {
    	let div;
    	let useActions_action;
    	let forwardEvents_action;

    	let div_levels = [
    		{
    			class: "mdc-line-ripple " + /*className*/ ctx[1]
    		},
    		exclude(/*$$props*/ ctx[5], ["use", "class", "active"])
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_attributes(div, div_data);
    			toggle_class(div, "mdc-line-ripple--active", /*active*/ ctx[2]);
    			add_location(div, file$7, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			/*div_binding*/ ctx[10](div);
    			useActions_action = useActions.call(null, div, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[4].call(null, div) || ({});
    		},
    		p: function update(ctx, [dirty]) {
    			set_attributes(div, get_spread_update(div_levels, [
    				dirty & /*className*/ 2 && ({
    					class: "mdc-line-ripple " + /*className*/ ctx[1]
    				}),
    				dirty & /*exclude, $$props*/ 32 && exclude(/*$$props*/ ctx[5], ["use", "class", "active"])
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			toggle_class(div, "mdc-line-ripple--active", /*active*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[10](null);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { active = false } = $$props;
    	let element;
    	let lineRipple;

    	onMount(() => {
    		lineRipple = new MDCLineRipple(element);
    	});

    	onDestroy(() => {
    		lineRipple && lineRipple.destroy();
    	});

    	function activate(...args) {
    		return lineRipple.activate(...args);
    	}

    	function deactivate(...args) {
    		return lineRipple.deactivate(...args);
    	}

    	function setRippleCenter(xCoordinate, ...args) {
    		return lineRipple.setRippleCenter(xCoordinate, ...args);
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(3, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("active" in $$new_props) $$invalidate(2, active = $$new_props.active);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			active,
    			element,
    			lineRipple
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("active" in $$props) $$invalidate(2, active = $$new_props.active);
    		if ("element" in $$props) $$invalidate(3, element = $$new_props.element);
    		if ("lineRipple" in $$props) lineRipple = $$new_props.lineRipple;
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		active,
    		element,
    		forwardEvents,
    		$$props,
    		activate,
    		deactivate,
    		setRippleCenter,
    		lineRipple,
    		div_binding
    	];
    }

    class LineRipple extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {
    			use: 0,
    			class: 1,
    			active: 2,
    			activate: 6,
    			deactivate: 7,
    			setRippleCenter: 8
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LineRipple",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get use() {
    		throw new Error("<LineRipple>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<LineRipple>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<LineRipple>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<LineRipple>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get active() {
    		throw new Error("<LineRipple>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set active(value) {
    		throw new Error("<LineRipple>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get activate() {
    		return this.$$.ctx[6];
    	}

    	set activate(value) {
    		throw new Error("<LineRipple>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get deactivate() {
    		return this.$$.ctx[7];
    	}

    	set deactivate(value) {
    		throw new Error("<LineRipple>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setRippleCenter() {
    		return this.$$.ctx[8];
    	}

    	set setRippleCenter(value) {
    		throw new Error("<LineRipple>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/notched-outline/NotchedOutline.svelte generated by Svelte v3.16.0 */
    const file$8 = "node_modules/@smui/notched-outline/NotchedOutline.svelte";

    // (11:2) {#if !noLabel}
    function create_if_block$4(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[11].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[10], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "mdc-notched-outline__notch");
    			add_location(div, file$8, 11, 4, 345);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 1024) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[10], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[10], dirty, null));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(11:2) {#if !noLabel}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	let if_block = !/*noLabel*/ ctx[3] && create_if_block$4(ctx);

    	let div2_levels = [
    		{
    			class: "mdc-notched-outline " + /*className*/ ctx[1]
    		},
    		exclude(/*$$props*/ ctx[6], ["use", "class", "notched", "noLabel"])
    	];

    	let div2_data = {};

    	for (let i = 0; i < div2_levels.length; i += 1) {
    		div2_data = assign(div2_data, div2_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = space();
    			if (if_block) if_block.c();
    			t1 = space();
    			div1 = element("div");
    			attr_dev(div0, "class", "mdc-notched-outline__leading");
    			add_location(div0, file$8, 9, 2, 275);
    			attr_dev(div1, "class", "mdc-notched-outline__trailing");
    			add_location(div1, file$8, 13, 2, 415);
    			set_attributes(div2, div2_data);
    			toggle_class(div2, "mdc-notched-outline--notched", /*notched*/ ctx[2]);
    			toggle_class(div2, "mdc-notched-outline--no-label", /*noLabel*/ ctx[3]);
    			add_location(div2, file$8, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div2, t0);
    			if (if_block) if_block.m(div2, null);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			/*div2_binding*/ ctx[12](div2);
    			useActions_action = useActions.call(null, div2, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[5].call(null, div2) || ({});
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*noLabel*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div2, t1);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			set_attributes(div2, get_spread_update(div2_levels, [
    				dirty & /*className*/ 2 && ({
    					class: "mdc-notched-outline " + /*className*/ ctx[1]
    				}),
    				dirty & /*exclude, $$props*/ 64 && exclude(/*$$props*/ ctx[6], ["use", "class", "notched", "noLabel"])
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			toggle_class(div2, "mdc-notched-outline--notched", /*notched*/ ctx[2]);
    			toggle_class(div2, "mdc-notched-outline--no-label", /*noLabel*/ ctx[3]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    			/*div2_binding*/ ctx[12](null);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { notched = false } = $$props;
    	let { noLabel = false } = $$props;
    	let element;
    	let notchedOutline;

    	onMount(() => {
    		notchedOutline = new MDCNotchedOutline(element);
    	});

    	onDestroy(() => {
    		notchedOutline && notchedOutline.destroy();
    	});

    	function notch(notchWidth, ...args) {
    		return notchedOutline.notch(notchWidth, ...args);
    	}

    	function closeNotch(...args) {
    		return notchedOutline.closeNotch(...args);
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(4, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(6, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("notched" in $$new_props) $$invalidate(2, notched = $$new_props.notched);
    		if ("noLabel" in $$new_props) $$invalidate(3, noLabel = $$new_props.noLabel);
    		if ("$$scope" in $$new_props) $$invalidate(10, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			notched,
    			noLabel,
    			element,
    			notchedOutline
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(6, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("notched" in $$props) $$invalidate(2, notched = $$new_props.notched);
    		if ("noLabel" in $$props) $$invalidate(3, noLabel = $$new_props.noLabel);
    		if ("element" in $$props) $$invalidate(4, element = $$new_props.element);
    		if ("notchedOutline" in $$props) notchedOutline = $$new_props.notchedOutline;
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		notched,
    		noLabel,
    		element,
    		forwardEvents,
    		$$props,
    		notch,
    		closeNotch,
    		notchedOutline,
    		$$scope,
    		$$slots,
    		div2_binding
    	];
    }

    class NotchedOutline extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			use: 0,
    			class: 1,
    			notched: 2,
    			noLabel: 3,
    			notch: 7,
    			closeNotch: 8
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NotchedOutline",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get use() {
    		throw new Error("<NotchedOutline>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<NotchedOutline>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<NotchedOutline>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<NotchedOutline>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get notched() {
    		throw new Error("<NotchedOutline>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set notched(value) {
    		throw new Error("<NotchedOutline>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get noLabel() {
    		throw new Error("<NotchedOutline>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set noLabel(value) {
    		throw new Error("<NotchedOutline>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get notch() {
    		return this.$$.ctx[7];
    	}

    	set notch(value) {
    		throw new Error("<NotchedOutline>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeNotch() {
    		return this.$$.ctx[8];
    	}

    	set closeNotch(value) {
    		throw new Error("<NotchedOutline>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/select/Select.svelte generated by Svelte v3.16.0 */
    const file$9 = "node_modules/@smui/select/Select.svelte";
    const get_label_slot_changes_1 = dirty => ({});
    const get_label_slot_context_1 = ctx => ({});
    const get_label_slot_changes = dirty => ({});
    const get_label_slot_context = ctx => ({});
    const get_icon_slot_changes = dirty => ({});
    const get_icon_slot_context = ctx => ({});

    // (46:2) {:else}
    function create_else_block$4(ctx) {
    	let select_1;
    	let useActions_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[35].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[44], null);

    	let select_1_levels = [
    		{
    			class: "mdc-select__native-control " + /*input$class*/ ctx[15]
    		},
    		{ disabled: /*disabled*/ ctx[5] },
    		{ required: /*required*/ ctx[12] },
    		{ id: /*inputId*/ ctx[13] },
    		exclude(prefixFilter(/*$$props*/ ctx[22], "input$"), ["use", "class"])
    	];

    	let select_1_data = {};

    	for (let i = 0; i < select_1_levels.length; i += 1) {
    		select_1_data = assign(select_1_data, select_1_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			select_1 = element("select");
    			if (default_slot) default_slot.c();
    			set_attributes(select_1, select_1_data);
    			add_location(select_1, file$9, 46, 4, 1612);

    			dispose = [
    				listen_dev(select_1, "change", /*change_handler_1*/ ctx[38], false, false, false),
    				listen_dev(select_1, "input", /*input_handler_1*/ ctx[39], false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, select_1, anchor);

    			if (default_slot) {
    				default_slot.m(select_1, null);
    			}

    			/*select_1_binding*/ ctx[42](select_1);
    			useActions_action = useActions.call(null, select_1, /*input$use*/ ctx[14]) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty[1] & /*$$scope*/ 8192) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[44], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[44], dirty, null));
    			}

    			set_attributes(select_1, get_spread_update(select_1_levels, [
    				dirty[0] & /*input$class*/ 32768 && ({
    					class: "mdc-select__native-control " + /*input$class*/ ctx[15]
    				}),
    				dirty[0] & /*disabled*/ 32 && ({ disabled: /*disabled*/ ctx[5] }),
    				dirty[0] & /*required*/ 4096 && ({ required: /*required*/ ctx[12] }),
    				dirty[0] & /*inputId*/ 8192 && ({ id: /*inputId*/ ctx[13] }),
    				dirty[0] & /*$$props*/ 4194304 && exclude(prefixFilter(/*$$props*/ ctx[22], "input$"), ["use", "class"])
    			]));

    			if (is_function(useActions_action.update) && dirty[0] & /*input$use*/ 16384) useActions_action.update.call(null, /*input$use*/ ctx[14]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(select_1);
    			if (default_slot) default_slot.d(detaching);
    			/*select_1_binding*/ ctx[42](null);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(46:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (16:2) {#if enhanced}
    function create_if_block_5(ctx) {
    	let input;
    	let useActions_action;
    	let t0;
    	let div;
    	let t1;
    	let div_id_value;
    	let div_aria_labelledby_value;
    	let div_aria_required_value;
    	let t2;
    	let updating_anchorElement;
    	let current;
    	let dispose;

    	let input_levels = [
    		{ type: "hidden" },
    		{ disabled: /*disabled*/ ctx[5] },
    		{ required: /*required*/ ctx[12] },
    		{ id: /*inputId*/ ctx[13] },
    		{ value: /*value*/ ctx[0] },
    		exclude(prefixFilter(/*$$props*/ ctx[22], "input$"), ["use"])
    	];

    	let input_data = {};

    	for (let i = 0; i < input_levels.length; i += 1) {
    		input_data = assign(input_data, input_levels[i]);
    	}

    	const menu_spread_levels = [
    		{
    			class: "mdc-select__menu " + /*menu$class*/ ctx[17]
    		},
    		{ role: "listbox" },
    		{ anchor: false },
    		exclude(prefixFilter(/*$$props*/ ctx[22], "menu$"), ["class"])
    	];

    	function menu_anchorElement_binding(value_1) {
    		/*menu_anchorElement_binding*/ ctx[41].call(null, value_1);
    	}

    	let menu_props = {
    		$$slots: { default: [create_default_slot_3] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < menu_spread_levels.length; i += 1) {
    		menu_props = assign(menu_props, menu_spread_levels[i]);
    	}

    	if (/*element*/ ctx[18] !== void 0) {
    		menu_props.anchorElement = /*element*/ ctx[18];
    	}

    	const menu = new Menu({ props: menu_props, $$inline: true });
    	binding_callbacks.push(() => bind(menu, "anchorElement", menu_anchorElement_binding));

    	const block = {
    		c: function create() {
    			input = element("input");
    			t0 = space();
    			div = element("div");
    			t1 = text(/*selectedText*/ ctx[11]);
    			t2 = space();
    			create_component(menu.$$.fragment);
    			set_attributes(input, input_data);
    			add_location(input, file$9, 16, 4, 757);
    			attr_dev(div, "id", div_id_value = /*inputId*/ ctx[13] + "-smui-selected-text");
    			attr_dev(div, "class", "mdc-select__selected-text");
    			attr_dev(div, "role", "button");
    			attr_dev(div, "aria-haspopup", "listbox");
    			attr_dev(div, "aria-labelledby", div_aria_labelledby_value = "" + (/*inputId*/ ctx[13] + "-smui-label" + " " + (/*inputId*/ ctx[13] + "-smui-selected-text")));
    			attr_dev(div, "aria-required", div_aria_required_value = /*required*/ ctx[12] ? "true" : "false");
    			add_location(div, file$9, 28, 4, 1024);

    			dispose = [
    				listen_dev(input, "change", /*change_handler*/ ctx[36], false, false, false),
    				listen_dev(input, "input", /*input_handler*/ ctx[37], false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			/*input_binding*/ ctx[40](input);
    			useActions_action = useActions.call(null, input, /*input$use*/ ctx[14]) || ({});
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, t1);
    			insert_dev(target, t2, anchor);
    			mount_component(menu, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			set_attributes(input, get_spread_update(input_levels, [
    				{ type: "hidden" },
    				dirty[0] & /*disabled*/ 32 && ({ disabled: /*disabled*/ ctx[5] }),
    				dirty[0] & /*required*/ 4096 && ({ required: /*required*/ ctx[12] }),
    				dirty[0] & /*inputId*/ 8192 && ({ id: /*inputId*/ ctx[13] }),
    				dirty[0] & /*value*/ 1 && ({ value: /*value*/ ctx[0] }),
    				dirty[0] & /*$$props*/ 4194304 && exclude(prefixFilter(/*$$props*/ ctx[22], "input$"), ["use"])
    			]));

    			if (is_function(useActions_action.update) && dirty[0] & /*input$use*/ 16384) useActions_action.update.call(null, /*input$use*/ ctx[14]);
    			if (!current || dirty[0] & /*selectedText*/ 2048) set_data_dev(t1, /*selectedText*/ ctx[11]);

    			if (!current || dirty[0] & /*inputId*/ 8192 && div_id_value !== (div_id_value = /*inputId*/ ctx[13] + "-smui-selected-text")) {
    				attr_dev(div, "id", div_id_value);
    			}

    			if (!current || dirty[0] & /*inputId*/ 8192 && div_aria_labelledby_value !== (div_aria_labelledby_value = "" + (/*inputId*/ ctx[13] + "-smui-label" + " " + (/*inputId*/ ctx[13] + "-smui-selected-text")))) {
    				attr_dev(div, "aria-labelledby", div_aria_labelledby_value);
    			}

    			if (!current || dirty[0] & /*required*/ 4096 && div_aria_required_value !== (div_aria_required_value = /*required*/ ctx[12] ? "true" : "false")) {
    				attr_dev(div, "aria-required", div_aria_required_value);
    			}

    			const menu_changes = dirty[0] & /*menu$class, $$props*/ 4325376
    			? get_spread_update(menu_spread_levels, [
    					dirty[0] & /*menu$class*/ 131072 && ({
    						class: "mdc-select__menu " + /*menu$class*/ ctx[17]
    					}),
    					menu_spread_levels[1],
    					menu_spread_levels[2],
    					dirty[0] & /*$$props*/ 4194304 && get_spread_object(exclude(prefixFilter(/*$$props*/ ctx[22], "menu$"), ["class"]))
    				])
    			: {};

    			if (dirty[1] & /*$$scope*/ 8192) {
    				menu_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_anchorElement && dirty[0] & /*element*/ 262144) {
    				updating_anchorElement = true;
    				menu_changes.anchorElement = /*element*/ ctx[18];
    				add_flush_callback(() => updating_anchorElement = false);
    			}

    			menu.$set(menu_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			/*input_binding*/ ctx[40](null);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t2);
    			destroy_component(menu, detaching);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(16:2) {#if enhanced}",
    		ctx
    	});

    	return block;
    }

    // (44:6) <List {...prefixFilter($$props, 'list$')}>
    function create_default_slot_4(ctx) {
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[35].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[44], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty[1] & /*$$scope*/ 8192) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[44], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[44], dirty, null));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(44:6) <List {...prefixFilter($$props, 'list$')}>",
    		ctx
    	});

    	return block;
    }

    // (37:4) <Menu       class="mdc-select__menu {menu$class}"       role="listbox"       anchor={false}       bind:anchorElement={element}       {...exclude(prefixFilter($$props, 'menu$'), ['class'])}     >
    function create_default_slot_3(ctx) {
    	let current;
    	const list_spread_levels = [prefixFilter(/*$$props*/ ctx[22], "list$")];

    	let list_props = {
    		$$slots: { default: [create_default_slot_4] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < list_spread_levels.length; i += 1) {
    		list_props = assign(list_props, list_spread_levels[i]);
    	}

    	const list = new List({ props: list_props, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(list.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(list, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const list_changes = dirty[0] & /*$$props*/ 4194304
    			? get_spread_update(list_spread_levels, [get_spread_object(prefixFilter(/*$$props*/ ctx[22], "list$"))])
    			: {};

    			if (dirty[1] & /*$$scope*/ 8192) {
    				list_changes.$$scope = { dirty, ctx };
    			}

    			list.$set(list_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(list.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(list.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(list, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(37:4) <Menu       class=\\\"mdc-select__menu {menu$class}\\\"       role=\\\"listbox\\\"       anchor={false}       bind:anchorElement={element}       {...exclude(prefixFilter($$props, 'menu$'), ['class'])}     >",
    		ctx
    	});

    	return block;
    }

    // (59:2) {#if variant !== 'outlined'}
    function create_if_block_2(ctx) {
    	let t;
    	let if_block1_anchor;
    	let current;
    	let if_block0 = !/*noLabel*/ ctx[9] && /*label*/ ctx[10] != null && create_if_block_4(ctx);
    	let if_block1 = /*ripple*/ ctx[4] && create_if_block_3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*noLabel*/ ctx[9] && /*label*/ ctx[10] != null) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    					transition_in(if_block0, 1);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*ripple*/ ctx[4]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    					transition_in(if_block1, 1);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(59:2) {#if variant !== 'outlined'}",
    		ctx
    	});

    	return block;
    }

    // (60:4) {#if !noLabel && label != null}
    function create_if_block_4(ctx) {
    	let current;

    	const floatinglabel_spread_levels = [
    		{ for: /*inputId*/ ctx[13] },
    		{ id: /*inputId*/ ctx[13] + "-smui-label" },
    		{
    			class: "" + ((/*value*/ ctx[0] !== ""
    			? "mdc-floating-label--float-above"
    			: "") + " " + /*label$class*/ ctx[16])
    		},
    		exclude(prefixFilter(/*$$props*/ ctx[22], "label$"), ["class"])
    	];

    	let floatinglabel_props = {
    		$$slots: { default: [create_default_slot_2] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < floatinglabel_spread_levels.length; i += 1) {
    		floatinglabel_props = assign(floatinglabel_props, floatinglabel_spread_levels[i]);
    	}

    	const floatinglabel = new FloatingLabel({
    			props: floatinglabel_props,
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(floatinglabel.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(floatinglabel, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const floatinglabel_changes = dirty[0] & /*inputId, value, label$class, $$props*/ 4268033
    			? get_spread_update(floatinglabel_spread_levels, [
    					dirty[0] & /*inputId*/ 8192 && ({ for: /*inputId*/ ctx[13] }),
    					dirty[0] & /*inputId*/ 8192 && ({ id: /*inputId*/ ctx[13] + "-smui-label" }),
    					dirty[0] & /*value, label$class*/ 65537 && ({
    						class: "" + ((/*value*/ ctx[0] !== ""
    						? "mdc-floating-label--float-above"
    						: "") + " " + /*label$class*/ ctx[16])
    					}),
    					dirty[0] & /*$$props*/ 4194304 && get_spread_object(exclude(prefixFilter(/*$$props*/ ctx[22], "label$"), ["class"]))
    				])
    			: {};

    			if (dirty[0] & /*label*/ 1024 | dirty[1] & /*$$scope*/ 8192) {
    				floatinglabel_changes.$$scope = { dirty, ctx };
    			}

    			floatinglabel.$set(floatinglabel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(floatinglabel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(floatinglabel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(floatinglabel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(60:4) {#if !noLabel && label != null}",
    		ctx
    	});

    	return block;
    }

    // (61:6) <FloatingLabel         for={inputId}         id={inputId+'-smui-label'}         class="{value !== '' ? 'mdc-floating-label--float-above' : ''} {label$class}"         {...exclude(prefixFilter($$props, 'label$'), ['class'])}       >
    function create_default_slot_2(ctx) {
    	let t;
    	let current;
    	const label_slot_template = /*$$slots*/ ctx[35].label;
    	const label_slot = create_slot(label_slot_template, ctx, /*$$scope*/ ctx[44], get_label_slot_context);

    	const block = {
    		c: function create() {
    			t = text(/*label*/ ctx[10]);
    			if (label_slot) label_slot.c();
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);

    			if (label_slot) {
    				label_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty[0] & /*label*/ 1024) set_data_dev(t, /*label*/ ctx[10]);

    			if (label_slot && label_slot.p && dirty[1] & /*$$scope*/ 8192) {
    				label_slot.p(get_slot_context(label_slot_template, ctx, /*$$scope*/ ctx[44], get_label_slot_context), get_slot_changes(label_slot_template, /*$$scope*/ ctx[44], dirty, get_label_slot_changes));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(label_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(label_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    			if (label_slot) label_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(61:6) <FloatingLabel         for={inputId}         id={inputId+'-smui-label'}         class=\\\"{value !== '' ? 'mdc-floating-label--float-above' : ''} {label$class}\\\"         {...exclude(prefixFilter($$props, 'label$'), ['class'])}       >",
    		ctx
    	});

    	return block;
    }

    // (68:4) {#if ripple}
    function create_if_block_3(ctx) {
    	let current;
    	const lineripple_spread_levels = [prefixFilter(/*$$props*/ ctx[22], "ripple$")];
    	let lineripple_props = {};

    	for (let i = 0; i < lineripple_spread_levels.length; i += 1) {
    		lineripple_props = assign(lineripple_props, lineripple_spread_levels[i]);
    	}

    	const lineripple = new LineRipple({ props: lineripple_props, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(lineripple.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(lineripple, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const lineripple_changes = dirty[0] & /*$$props*/ 4194304
    			? get_spread_update(lineripple_spread_levels, [get_spread_object(prefixFilter(/*$$props*/ ctx[22], "ripple$"))])
    			: {};

    			lineripple.$set(lineripple_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(lineripple.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(lineripple.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(lineripple, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(68:4) {#if ripple}",
    		ctx
    	});

    	return block;
    }

    // (72:2) {#if variant === 'outlined'}
    function create_if_block$5(ctx) {
    	let current;

    	const notchedoutline_spread_levels = [
    		{
    			noLabel: /*noLabel*/ ctx[9] || /*label*/ ctx[10] == null
    		},
    		prefixFilter(/*$$props*/ ctx[22], "outline$")
    	];

    	let notchedoutline_props = {
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < notchedoutline_spread_levels.length; i += 1) {
    		notchedoutline_props = assign(notchedoutline_props, notchedoutline_spread_levels[i]);
    	}

    	const notchedoutline = new NotchedOutline({
    			props: notchedoutline_props,
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(notchedoutline.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(notchedoutline, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const notchedoutline_changes = dirty[0] & /*noLabel, label, $$props*/ 4195840
    			? get_spread_update(notchedoutline_spread_levels, [
    					dirty[0] & /*noLabel, label*/ 1536 && ({
    						noLabel: /*noLabel*/ ctx[9] || /*label*/ ctx[10] == null
    					}),
    					dirty[0] & /*$$props*/ 4194304 && get_spread_object(prefixFilter(/*$$props*/ ctx[22], "outline$"))
    				])
    			: {};

    			if (dirty[0] & /*noLabel, label, inputId, value, label$class*/ 75265 | dirty[1] & /*$$scope*/ 8192) {
    				notchedoutline_changes.$$scope = { dirty, ctx };
    			}

    			notchedoutline.$set(notchedoutline_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(notchedoutline.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(notchedoutline.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(notchedoutline, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(72:2) {#if variant === 'outlined'}",
    		ctx
    	});

    	return block;
    }

    // (74:6) {#if !noLabel && label != null}
    function create_if_block_1$1(ctx) {
    	let current;

    	const floatinglabel_spread_levels = [
    		{ for: /*inputId*/ ctx[13] },
    		{
    			class: "" + ((/*value*/ ctx[0] !== ""
    			? "mdc-floating-label--float-above"
    			: "") + " " + /*label$class*/ ctx[16])
    		},
    		exclude(prefixFilter(/*$$props*/ ctx[22], "label$"), ["class"])
    	];

    	let floatinglabel_props = {
    		$$slots: { default: [create_default_slot_1] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < floatinglabel_spread_levels.length; i += 1) {
    		floatinglabel_props = assign(floatinglabel_props, floatinglabel_spread_levels[i]);
    	}

    	const floatinglabel = new FloatingLabel({
    			props: floatinglabel_props,
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(floatinglabel.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(floatinglabel, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const floatinglabel_changes = dirty[0] & /*inputId, value, label$class, $$props*/ 4268033
    			? get_spread_update(floatinglabel_spread_levels, [
    					dirty[0] & /*inputId*/ 8192 && ({ for: /*inputId*/ ctx[13] }),
    					dirty[0] & /*value, label$class*/ 65537 && ({
    						class: "" + ((/*value*/ ctx[0] !== ""
    						? "mdc-floating-label--float-above"
    						: "") + " " + /*label$class*/ ctx[16])
    					}),
    					dirty[0] & /*$$props*/ 4194304 && get_spread_object(exclude(prefixFilter(/*$$props*/ ctx[22], "label$"), ["class"]))
    				])
    			: {};

    			if (dirty[0] & /*label*/ 1024 | dirty[1] & /*$$scope*/ 8192) {
    				floatinglabel_changes.$$scope = { dirty, ctx };
    			}

    			floatinglabel.$set(floatinglabel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(floatinglabel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(floatinglabel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(floatinglabel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(74:6) {#if !noLabel && label != null}",
    		ctx
    	});

    	return block;
    }

    // (75:8) <FloatingLabel           for={inputId}           class="{value !== '' ? 'mdc-floating-label--float-above' : ''} {label$class}"           {...exclude(prefixFilter($$props, 'label$'), ['class'])}         >
    function create_default_slot_1(ctx) {
    	let t;
    	let current;
    	const label_slot_template = /*$$slots*/ ctx[35].label;
    	const label_slot = create_slot(label_slot_template, ctx, /*$$scope*/ ctx[44], get_label_slot_context_1);

    	const block = {
    		c: function create() {
    			t = text(/*label*/ ctx[10]);
    			if (label_slot) label_slot.c();
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);

    			if (label_slot) {
    				label_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty[0] & /*label*/ 1024) set_data_dev(t, /*label*/ ctx[10]);

    			if (label_slot && label_slot.p && dirty[1] & /*$$scope*/ 8192) {
    				label_slot.p(get_slot_context(label_slot_template, ctx, /*$$scope*/ ctx[44], get_label_slot_context_1), get_slot_changes(label_slot_template, /*$$scope*/ ctx[44], dirty, get_label_slot_changes_1));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(label_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(label_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    			if (label_slot) label_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(75:8) <FloatingLabel           for={inputId}           class=\\\"{value !== '' ? 'mdc-floating-label--float-above' : ''} {label$class}\\\"           {...exclude(prefixFilter($$props, 'label$'), ['class'])}         >",
    		ctx
    	});

    	return block;
    }

    // (73:4) <NotchedOutline noLabel={noLabel || label == null} {...prefixFilter($$props, 'outline$')}>
    function create_default_slot$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*noLabel*/ ctx[9] && /*label*/ ctx[10] != null && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*noLabel*/ ctx[9] && /*label*/ ctx[10] != null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block_1$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(73:4) <NotchedOutline noLabel={noLabel || label == null} {...prefixFilter($$props, 'outline$')}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let div;
    	let t0;
    	let i;
    	let t1;
    	let current_block_type_index;
    	let if_block0;
    	let t2;
    	let t3;
    	let forwardEvents_action;
    	let useActions_action;
    	let current;
    	let dispose;
    	const icon_slot_template = /*$$slots*/ ctx[35].icon;
    	const icon_slot = create_slot(icon_slot_template, ctx, /*$$scope*/ ctx[44], get_icon_slot_context);
    	const if_block_creators = [create_if_block_5, create_else_block$4];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*enhanced*/ ctx[6]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*variant*/ ctx[7] !== "outlined" && create_if_block_2(ctx);
    	let if_block2 = /*variant*/ ctx[7] === "outlined" && create_if_block$5(ctx);

    	let div_levels = [
    		exclude(/*$$props*/ ctx[22], [
    			"use",
    			"class",
    			"ripple",
    			"disabled",
    			"enhanced",
    			"variant",
    			"noLabel",
    			"withLeadingIcon",
    			"label",
    			"value",
    			"selectedIndex",
    			"selectedText",
    			"dirty",
    			"invalid",
    			"updateInvalid",
    			"required",
    			"input$",
    			"label$",
    			"ripple$",
    			"outline$",
    			"menu$",
    			"list$"
    		]),
    		{
    			class: "mdc-select " + /*className*/ ctx[3]
    		}
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (icon_slot) icon_slot.c();
    			t0 = space();
    			i = element("i");
    			t1 = space();
    			if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(i, "class", "mdc-select__dropdown-icon");
    			add_location(i, file$9, 14, 2, 694);
    			set_attributes(div, div_data);
    			toggle_class(div, "mdc-select--outlined", /*variant*/ ctx[7] === "outlined");
    			toggle_class(div, "mdc-select--disabled", /*disabled*/ ctx[5]);
    			toggle_class(div, "smui-select--standard", /*variant*/ ctx[7] === "standard");
    			toggle_class(div, "mdc-select--with-leading-icon", /*withLeadingIcon*/ ctx[8]);
    			toggle_class(div, "mdc-select--invalid", /*invalid*/ ctx[1]);
    			add_location(div, file$9, 0, 0, 0);
    			dispose = listen_dev(div, "MDCSelect:change", /*changeHandler*/ ctx[21], false, false, false);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (icon_slot) {
    				icon_slot.m(div, null);
    			}

    			append_dev(div, t0);
    			append_dev(div, i);
    			append_dev(div, t1);
    			if_blocks[current_block_type_index].m(div, null);
    			append_dev(div, t2);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t3);
    			if (if_block2) if_block2.m(div, null);
    			/*div_binding*/ ctx[43](div);
    			forwardEvents_action = /*forwardEvents*/ ctx[20].call(null, div) || ({});
    			useActions_action = useActions.call(null, div, /*use*/ ctx[2]) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (icon_slot && icon_slot.p && dirty[1] & /*$$scope*/ 8192) {
    				icon_slot.p(get_slot_context(icon_slot_template, ctx, /*$$scope*/ ctx[44], get_icon_slot_context), get_slot_changes(icon_slot_template, /*$$scope*/ ctx[44], dirty, get_icon_slot_changes));
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block0 = if_blocks[current_block_type_index];

    				if (!if_block0) {
    					if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block0.c();
    				}

    				transition_in(if_block0, 1);
    				if_block0.m(div, t2);
    			}

    			if (/*variant*/ ctx[7] !== "outlined") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    					transition_in(if_block1, 1);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div, t3);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*variant*/ ctx[7] === "outlined") {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    					transition_in(if_block2, 1);
    				} else {
    					if_block2 = create_if_block$5(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			set_attributes(div, get_spread_update(div_levels, [
    				dirty[0] & /*$$props*/ 4194304 && exclude(/*$$props*/ ctx[22], [
    					"use",
    					"class",
    					"ripple",
    					"disabled",
    					"enhanced",
    					"variant",
    					"noLabel",
    					"withLeadingIcon",
    					"label",
    					"value",
    					"selectedIndex",
    					"selectedText",
    					"dirty",
    					"invalid",
    					"updateInvalid",
    					"required",
    					"input$",
    					"label$",
    					"ripple$",
    					"outline$",
    					"menu$",
    					"list$"
    				]),
    				dirty[0] & /*className*/ 8 && ({
    					class: "mdc-select " + /*className*/ ctx[3]
    				})
    			]));

    			if (is_function(useActions_action.update) && dirty[0] & /*use*/ 4) useActions_action.update.call(null, /*use*/ ctx[2]);
    			toggle_class(div, "mdc-select--outlined", /*variant*/ ctx[7] === "outlined");
    			toggle_class(div, "mdc-select--disabled", /*disabled*/ ctx[5]);
    			toggle_class(div, "smui-select--standard", /*variant*/ ctx[7] === "standard");
    			toggle_class(div, "mdc-select--with-leading-icon", /*withLeadingIcon*/ ctx[8]);
    			toggle_class(div, "mdc-select--invalid", /*invalid*/ ctx[1]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(icon_slot, local);
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(icon_slot, local);
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (icon_slot) icon_slot.d(detaching);
    			if_blocks[current_block_type_index].d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			/*div_binding*/ ctx[43](null);
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    let counter = 0;

    function instance$c($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component, "MDCSelect:change");

    	const uninitializedValue = () => {
    		
    	};

    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { ripple = true } = $$props;
    	let { disabled = false } = $$props;
    	let { enhanced = false } = $$props;
    	let { variant = "standard" } = $$props;
    	let { withLeadingIcon = false } = $$props;
    	let { noLabel = false } = $$props;
    	let { label = null } = $$props;
    	let { value = "" } = $$props;
    	let { selectedIndex = uninitializedValue } = $$props;
    	let { selectedText = "" } = $$props;
    	let { dirty = false } = $$props;
    	let { invalid = uninitializedValue } = $$props;
    	let { updateInvalid = invalid === uninitializedValue } = $$props;
    	let { required = false } = $$props;
    	let { inputId = "SMUI-select-" + counter++ } = $$props;
    	let { input$use = [] } = $$props;
    	let { input$class = "" } = $$props;
    	let { label$class = "" } = $$props;
    	let { menu$class = "" } = $$props;
    	let element;
    	let select;
    	let inputElement;
    	let menuPromiseResolve;
    	let menuPromise = new Promise(resolve => menuPromiseResolve = resolve);
    	let addLayoutListener = getContext("SMUI:addLayoutListener");
    	let removeLayoutListener;
    	setContext("SMUI:menu:instantiate", false);
    	setContext("SMUI:menu:getInstance", getMenuInstancePromise);
    	setContext("SMUI:list:role", "listbox");
    	setContext("SMUI:select:option:enhanced", enhanced);

    	if (addLayoutListener) {
    		removeLayoutListener = addLayoutListener(layout);
    	}

    	onMount(async () => {
    		$$invalidate(28, select = new MDCSelect(element));
    		menuPromiseResolve(select.menu_);

    		if (!ripple && select.ripple) {
    			select.ripple.destroy();
    		}

    		if (updateInvalid) {
    			$$invalidate(1, invalid = inputElement.matches(":invalid"));
    		}
    	});

    	onDestroy(() => {
    		select && select.destroy();

    		if (removeLayoutListener) {
    			removeLayoutListener();
    		}
    	});

    	function getMenuInstancePromise() {
    		return menuPromise;
    	}

    	function changeHandler(e) {
    		$$invalidate(0, value = e.detail.value);
    		$$invalidate(23, selectedIndex = e.detail.index);
    		$$invalidate(24, dirty = true);

    		if (updateInvalid) {
    			$$invalidate(1, invalid = inputElement.matches(":invalid"));
    		}
    	}

    	function focus(...args) {
    		return inputElement.focus(...args);
    	}

    	function layout(...args) {
    		return select.layout(...args);
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function change_handler(event) {
    		bubble($$self, event);
    	}

    	function input_handler(event) {
    		bubble($$self, event);
    	}

    	function change_handler_1(event) {
    		bubble($$self, event);
    	}

    	function input_handler_1(event) {
    		bubble($$self, event);
    	}

    	function input_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(19, inputElement = $$value);
    		});
    	}

    	function menu_anchorElement_binding(value_1) {
    		element = value_1;
    		$$invalidate(18, element);
    	}

    	function select_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(19, inputElement = $$value);
    		});
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(18, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(22, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(2, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(3, className = $$new_props.class);
    		if ("ripple" in $$new_props) $$invalidate(4, ripple = $$new_props.ripple);
    		if ("disabled" in $$new_props) $$invalidate(5, disabled = $$new_props.disabled);
    		if ("enhanced" in $$new_props) $$invalidate(6, enhanced = $$new_props.enhanced);
    		if ("variant" in $$new_props) $$invalidate(7, variant = $$new_props.variant);
    		if ("withLeadingIcon" in $$new_props) $$invalidate(8, withLeadingIcon = $$new_props.withLeadingIcon);
    		if ("noLabel" in $$new_props) $$invalidate(9, noLabel = $$new_props.noLabel);
    		if ("label" in $$new_props) $$invalidate(10, label = $$new_props.label);
    		if ("value" in $$new_props) $$invalidate(0, value = $$new_props.value);
    		if ("selectedIndex" in $$new_props) $$invalidate(23, selectedIndex = $$new_props.selectedIndex);
    		if ("selectedText" in $$new_props) $$invalidate(11, selectedText = $$new_props.selectedText);
    		if ("dirty" in $$new_props) $$invalidate(24, dirty = $$new_props.dirty);
    		if ("invalid" in $$new_props) $$invalidate(1, invalid = $$new_props.invalid);
    		if ("updateInvalid" in $$new_props) $$invalidate(25, updateInvalid = $$new_props.updateInvalid);
    		if ("required" in $$new_props) $$invalidate(12, required = $$new_props.required);
    		if ("inputId" in $$new_props) $$invalidate(13, inputId = $$new_props.inputId);
    		if ("input$use" in $$new_props) $$invalidate(14, input$use = $$new_props.input$use);
    		if ("input$class" in $$new_props) $$invalidate(15, input$class = $$new_props.input$class);
    		if ("label$class" in $$new_props) $$invalidate(16, label$class = $$new_props.label$class);
    		if ("menu$class" in $$new_props) $$invalidate(17, menu$class = $$new_props.menu$class);
    		if ("$$scope" in $$new_props) $$invalidate(44, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			counter,
    			use,
    			className,
    			ripple,
    			disabled,
    			enhanced,
    			variant,
    			withLeadingIcon,
    			noLabel,
    			label,
    			value,
    			selectedIndex,
    			selectedText,
    			dirty,
    			invalid,
    			updateInvalid,
    			required,
    			inputId,
    			input$use,
    			input$class,
    			label$class,
    			menu$class,
    			element,
    			select,
    			inputElement,
    			menuPromiseResolve,
    			menuPromise,
    			addLayoutListener,
    			removeLayoutListener
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(22, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(2, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(3, className = $$new_props.className);
    		if ("ripple" in $$props) $$invalidate(4, ripple = $$new_props.ripple);
    		if ("disabled" in $$props) $$invalidate(5, disabled = $$new_props.disabled);
    		if ("enhanced" in $$props) $$invalidate(6, enhanced = $$new_props.enhanced);
    		if ("variant" in $$props) $$invalidate(7, variant = $$new_props.variant);
    		if ("withLeadingIcon" in $$props) $$invalidate(8, withLeadingIcon = $$new_props.withLeadingIcon);
    		if ("noLabel" in $$props) $$invalidate(9, noLabel = $$new_props.noLabel);
    		if ("label" in $$props) $$invalidate(10, label = $$new_props.label);
    		if ("value" in $$props) $$invalidate(0, value = $$new_props.value);
    		if ("selectedIndex" in $$props) $$invalidate(23, selectedIndex = $$new_props.selectedIndex);
    		if ("selectedText" in $$props) $$invalidate(11, selectedText = $$new_props.selectedText);
    		if ("dirty" in $$props) $$invalidate(24, dirty = $$new_props.dirty);
    		if ("invalid" in $$props) $$invalidate(1, invalid = $$new_props.invalid);
    		if ("updateInvalid" in $$props) $$invalidate(25, updateInvalid = $$new_props.updateInvalid);
    		if ("required" in $$props) $$invalidate(12, required = $$new_props.required);
    		if ("inputId" in $$props) $$invalidate(13, inputId = $$new_props.inputId);
    		if ("input$use" in $$props) $$invalidate(14, input$use = $$new_props.input$use);
    		if ("input$class" in $$props) $$invalidate(15, input$class = $$new_props.input$class);
    		if ("label$class" in $$props) $$invalidate(16, label$class = $$new_props.label$class);
    		if ("menu$class" in $$props) $$invalidate(17, menu$class = $$new_props.menu$class);
    		if ("element" in $$props) $$invalidate(18, element = $$new_props.element);
    		if ("select" in $$props) $$invalidate(28, select = $$new_props.select);
    		if ("inputElement" in $$props) $$invalidate(19, inputElement = $$new_props.inputElement);
    		if ("menuPromiseResolve" in $$props) menuPromiseResolve = $$new_props.menuPromiseResolve;
    		if ("menuPromise" in $$props) menuPromise = $$new_props.menuPromise;
    		if ("addLayoutListener" in $$props) addLayoutListener = $$new_props.addLayoutListener;
    		if ("removeLayoutListener" in $$props) removeLayoutListener = $$new_props.removeLayoutListener;
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*select, value*/ 268435457) {
    			 if (select && select.value !== value) {
    				$$invalidate(28, select.value = value, select);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*select, selectedIndex*/ 276824064) {
    			 if (select && select.selectedIndex !== selectedIndex) {
    				if (selectedIndex === uninitializedValue) {
    					$$invalidate(23, selectedIndex = select.selectedIndex);
    				} else {
    					$$invalidate(28, select.selectedIndex = selectedIndex, select);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*select, disabled*/ 268435488) {
    			 if (select && select.disabled !== disabled) {
    				$$invalidate(28, select.disabled = disabled, select);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*select, invalid, updateInvalid*/ 301989890) {
    			 if (select && select.valid !== !invalid) {
    				if (updateInvalid) {
    					$$invalidate(1, invalid = !select.valid);
    				} else {
    					$$invalidate(28, select.valid = !invalid, select);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*select, required*/ 268439552) {
    			 if (select && select.required !== required) {
    				$$invalidate(28, select.required = required, select);
    			}
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		value,
    		invalid,
    		use,
    		className,
    		ripple,
    		disabled,
    		enhanced,
    		variant,
    		withLeadingIcon,
    		noLabel,
    		label,
    		selectedText,
    		required,
    		inputId,
    		input$use,
    		input$class,
    		label$class,
    		menu$class,
    		element,
    		inputElement,
    		forwardEvents,
    		changeHandler,
    		$$props,
    		selectedIndex,
    		dirty,
    		updateInvalid,
    		focus,
    		layout,
    		select,
    		menuPromiseResolve,
    		removeLayoutListener,
    		uninitializedValue,
    		menuPromise,
    		addLayoutListener,
    		getMenuInstancePromise,
    		$$slots,
    		change_handler,
    		input_handler,
    		change_handler_1,
    		input_handler_1,
    		input_binding,
    		menu_anchorElement_binding,
    		select_1_binding,
    		div_binding,
    		$$scope
    	];
    }

    class Select extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$c,
    			create_fragment$c,
    			safe_not_equal,
    			{
    				use: 2,
    				class: 3,
    				ripple: 4,
    				disabled: 5,
    				enhanced: 6,
    				variant: 7,
    				withLeadingIcon: 8,
    				noLabel: 9,
    				label: 10,
    				value: 0,
    				selectedIndex: 23,
    				selectedText: 11,
    				dirty: 24,
    				invalid: 1,
    				updateInvalid: 25,
    				required: 12,
    				inputId: 13,
    				input$use: 14,
    				input$class: 15,
    				label$class: 16,
    				menu$class: 17,
    				focus: 26,
    				layout: 27
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Select",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get use() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ripple() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ripple(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get enhanced() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set enhanced(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get variant() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variant(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get withLeadingIcon() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set withLeadingIcon(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get noLabel() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set noLabel(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedIndex() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedIndex(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedText() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedText(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dirty() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dirty(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get invalid() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set invalid(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get updateInvalid() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set updateInvalid(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get required() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set required(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get inputId() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set inputId(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get input$use() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input$use(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get input$class() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input$class(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label$class() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label$class(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get menu$class() {
    		throw new Error("<Select>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set menu$class(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get focus() {
    		return this.$$.ctx[26];
    	}

    	set focus(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get layout() {
    		return this.$$.ctx[27];
    	}

    	set layout(value) {
    		throw new Error("<Select>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/list/Item.svelte generated by Svelte v3.16.0 */
    const file$a = "node_modules/@smui/list/Item.svelte";

    // (34:0) {:else}
    function create_else_block$5(ctx) {
    	let li;
    	let Ripple_action;
    	let forwardEvents_action;
    	let useActions_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[25].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[24], null);

    	let li_levels = [
    		/*props*/ ctx[12],
    		{
    			class: "mdc-list-item " + /*className*/ ctx[2]
    		},
    		{ role: /*role*/ ctx[6] },
    		{
    			"aria-selected": /*role*/ ctx[6] === "option"
    			? /*selected*/ ctx[7] ? "true" : "false"
    			: undefined
    		},
    		{
    			"aria-checked": /*role*/ ctx[6] === "radio" || /*role*/ ctx[6] === "checkbox"
    			? /*checked*/ ctx[10] ? "true" : "false"
    			: undefined
    		},
    		{ tabindex: /*tabindex*/ ctx[0] }
    	];

    	let li_data = {};

    	for (let i = 0; i < li_levels.length; i += 1) {
    		li_data = assign(li_data, li_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			if (default_slot) default_slot.c();
    			set_attributes(li, li_data);
    			toggle_class(li, "mdc-list-item--activated", /*activated*/ ctx[5]);
    			toggle_class(li, "mdc-list-item--selected", /*selected*/ ctx[7]);
    			toggle_class(li, "mdc-list-item--disabled", /*disabled*/ ctx[8]);
    			toggle_class(li, "mdc-menu-item--selected", /*role*/ ctx[6] === "menuitem" && /*selected*/ ctx[7]);
    			add_location(li, file$a, 34, 2, 985);

    			dispose = [
    				listen_dev(li, "click", /*action*/ ctx[15], false, false, false),
    				listen_dev(li, "keydown", /*handleKeydown*/ ctx[16], false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);

    			if (default_slot) {
    				default_slot.m(li, null);
    			}

    			/*li_binding*/ ctx[28](li);

    			Ripple_action = Ripple.call(null, li, [
    				/*ripple*/ ctx[3],
    				{
    					unbounded: false,
    					color: /*color*/ ctx[4]
    				}
    			]) || ({});

    			forwardEvents_action = /*forwardEvents*/ ctx[13].call(null, li) || ({});
    			useActions_action = useActions.call(null, li, /*use*/ ctx[1]) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 16777216) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[24], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[24], dirty, null));
    			}

    			set_attributes(li, get_spread_update(li_levels, [
    				dirty & /*props*/ 4096 && /*props*/ ctx[12],
    				dirty & /*className*/ 4 && ({
    					class: "mdc-list-item " + /*className*/ ctx[2]
    				}),
    				dirty & /*role*/ 64 && ({ role: /*role*/ ctx[6] }),
    				dirty & /*role, selected, undefined*/ 192 && ({
    					"aria-selected": /*role*/ ctx[6] === "option"
    					? /*selected*/ ctx[7] ? "true" : "false"
    					: undefined
    				}),
    				dirty & /*role, checked, undefined*/ 1088 && ({
    					"aria-checked": /*role*/ ctx[6] === "radio" || /*role*/ ctx[6] === "checkbox"
    					? /*checked*/ ctx[10] ? "true" : "false"
    					: undefined
    				}),
    				dirty & /*tabindex*/ 1 && ({ tabindex: /*tabindex*/ ctx[0] })
    			]));

    			if (is_function(Ripple_action.update) && dirty & /*ripple, color*/ 24) Ripple_action.update.call(null, [
    				/*ripple*/ ctx[3],
    				{
    					unbounded: false,
    					color: /*color*/ ctx[4]
    				}
    			]);

    			if (is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);
    			toggle_class(li, "mdc-list-item--activated", /*activated*/ ctx[5]);
    			toggle_class(li, "mdc-list-item--selected", /*selected*/ ctx[7]);
    			toggle_class(li, "mdc-list-item--disabled", /*disabled*/ ctx[8]);
    			toggle_class(li, "mdc-menu-item--selected", /*role*/ ctx[6] === "menuitem" && /*selected*/ ctx[7]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if (default_slot) default_slot.d(detaching);
    			/*li_binding*/ ctx[28](null);
    			if (Ripple_action && is_function(Ripple_action.destroy)) Ripple_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(34:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (18:23) 
    function create_if_block_1$2(ctx) {
    	let span;
    	let forwardEvents_action;
    	let useActions_action;
    	let Ripple_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[25].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[24], null);

    	let span_levels = [
    		/*props*/ ctx[12],
    		{
    			class: "mdc-list-item " + /*className*/ ctx[2]
    		},
    		{
    			"aria-current": /*activated*/ ctx[5] ? "page" : undefined
    		},
    		{ tabindex: /*tabindex*/ ctx[0] }
    	];

    	let span_data = {};

    	for (let i = 0; i < span_levels.length; i += 1) {
    		span_data = assign(span_data, span_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			span = element("span");
    			if (default_slot) default_slot.c();
    			set_attributes(span, span_data);
    			toggle_class(span, "mdc-list-item--disabled", /*disabled*/ ctx[8]);
    			toggle_class(span, "mdc-list-item--activated", /*activated*/ ctx[5]);
    			toggle_class(span, "mdc-list-item--selected", /*selected*/ ctx[7]);
    			add_location(span, file$a, 18, 2, 513);

    			dispose = [
    				listen_dev(span, "click", /*action*/ ctx[15], false, false, false),
    				listen_dev(span, "keydown", /*handleKeydown*/ ctx[16], false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);

    			if (default_slot) {
    				default_slot.m(span, null);
    			}

    			/*span_binding*/ ctx[27](span);
    			forwardEvents_action = /*forwardEvents*/ ctx[13].call(null, span) || ({});
    			useActions_action = useActions.call(null, span, /*use*/ ctx[1]) || ({});

    			Ripple_action = Ripple.call(null, span, [
    				/*ripple*/ ctx[3],
    				{
    					unbounded: false,
    					color: /*color*/ ctx[4]
    				}
    			]) || ({});

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 16777216) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[24], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[24], dirty, null));
    			}

    			set_attributes(span, get_spread_update(span_levels, [
    				dirty & /*props*/ 4096 && /*props*/ ctx[12],
    				dirty & /*className*/ 4 && ({
    					class: "mdc-list-item " + /*className*/ ctx[2]
    				}),
    				dirty & /*activated, undefined*/ 32 && ({
    					"aria-current": /*activated*/ ctx[5] ? "page" : undefined
    				}),
    				dirty & /*tabindex*/ 1 && ({ tabindex: /*tabindex*/ ctx[0] })
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);

    			if (is_function(Ripple_action.update) && dirty & /*ripple, color*/ 24) Ripple_action.update.call(null, [
    				/*ripple*/ ctx[3],
    				{
    					unbounded: false,
    					color: /*color*/ ctx[4]
    				}
    			]);

    			toggle_class(span, "mdc-list-item--disabled", /*disabled*/ ctx[8]);
    			toggle_class(span, "mdc-list-item--activated", /*activated*/ ctx[5]);
    			toggle_class(span, "mdc-list-item--selected", /*selected*/ ctx[7]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (default_slot) default_slot.d(detaching);
    			/*span_binding*/ ctx[27](null);
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (Ripple_action && is_function(Ripple_action.destroy)) Ripple_action.destroy();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(18:23) ",
    		ctx
    	});

    	return block;
    }

    // (1:0) {#if nav && href}
    function create_if_block$6(ctx) {
    	let a;
    	let Ripple_action;
    	let forwardEvents_action;
    	let useActions_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[25].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[24], null);

    	let a_levels = [
    		/*props*/ ctx[12],
    		{
    			class: "mdc-list-item " + /*className*/ ctx[2]
    		},
    		{ href: /*href*/ ctx[9] },
    		{
    			"aria-current": /*activated*/ ctx[5] ? "page" : undefined
    		},
    		{ tabindex: /*tabindex*/ ctx[0] }
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			set_attributes(a, a_data);
    			toggle_class(a, "mdc-list-item--activated", /*activated*/ ctx[5]);
    			toggle_class(a, "mdc-list-item--selected", /*selected*/ ctx[7]);
    			toggle_class(a, "mdc-list-item--disabled", /*disabled*/ ctx[8]);
    			add_location(a, file$a, 1, 2, 20);

    			dispose = [
    				listen_dev(a, "click", /*action*/ ctx[15], false, false, false),
    				listen_dev(a, "keydown", /*handleKeydown*/ ctx[16], false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			/*a_binding*/ ctx[26](a);

    			Ripple_action = Ripple.call(null, a, [
    				/*ripple*/ ctx[3],
    				{
    					unbounded: false,
    					color: /*color*/ ctx[4]
    				}
    			]) || ({});

    			forwardEvents_action = /*forwardEvents*/ ctx[13].call(null, a) || ({});
    			useActions_action = useActions.call(null, a, /*use*/ ctx[1]) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 16777216) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[24], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[24], dirty, null));
    			}

    			set_attributes(a, get_spread_update(a_levels, [
    				dirty & /*props*/ 4096 && /*props*/ ctx[12],
    				dirty & /*className*/ 4 && ({
    					class: "mdc-list-item " + /*className*/ ctx[2]
    				}),
    				dirty & /*href*/ 512 && ({ href: /*href*/ ctx[9] }),
    				dirty & /*activated, undefined*/ 32 && ({
    					"aria-current": /*activated*/ ctx[5] ? "page" : undefined
    				}),
    				dirty & /*tabindex*/ 1 && ({ tabindex: /*tabindex*/ ctx[0] })
    			]));

    			if (is_function(Ripple_action.update) && dirty & /*ripple, color*/ 24) Ripple_action.update.call(null, [
    				/*ripple*/ ctx[3],
    				{
    					unbounded: false,
    					color: /*color*/ ctx[4]
    				}
    			]);

    			if (is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);
    			toggle_class(a, "mdc-list-item--activated", /*activated*/ ctx[5]);
    			toggle_class(a, "mdc-list-item--selected", /*selected*/ ctx[7]);
    			toggle_class(a, "mdc-list-item--disabled", /*disabled*/ ctx[8]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			/*a_binding*/ ctx[26](null);
    			if (Ripple_action && is_function(Ripple_action.destroy)) Ripple_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(1:0) {#if nav && href}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$6, create_if_block_1$2, create_else_block$5];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*nav*/ ctx[14] && /*href*/ ctx[9]) return 0;
    		if (/*nav*/ ctx[14] && !/*href*/ ctx[9]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    let counter$1 = 0;

    function instance$d($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let checked = false;
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { ripple = true } = $$props;
    	let { color = null } = $$props;
    	let { nonInteractive = getContext("SMUI:list:nonInteractive") } = $$props;
    	let { activated = false } = $$props;
    	let { role = getContext("SMUI:list:item:role") } = $$props;
    	let { selected = false } = $$props;
    	let { disabled = false } = $$props;
    	let { tabindex = !nonInteractive && !disabled && (selected || checked) && "0" || "-1" } = $$props;
    	let { href = false } = $$props;
    	let { inputId = "SMUI-form-field-list-" + counter$1++ } = $$props;
    	let element;
    	let addTabindexIfNoItemsSelectedRaf;
    	let nav = getContext("SMUI:list:item:nav");
    	setContext("SMUI:generic:input:props", { id: inputId });
    	setContext("SMUI:generic:input:setChecked", setChecked);

    	onMount(() => {
    		if (!selected && !nonInteractive) {
    			let first = true;
    			let el = element;

    			while (el.previousSibling) {
    				el = el.previousSibling;

    				if (el.nodeType === 1 && el.classList.contains("mdc-list-item") && !el.classList.contains("mdc-list-item--disabled")) {
    					first = false;
    					break;
    				}
    			}

    			if (first) {
    				addTabindexIfNoItemsSelectedRaf = window.requestAnimationFrame(addTabindexIfNoItemsSelected);
    			}
    		}
    	});

    	onDestroy(() => {
    		if (addTabindexIfNoItemsSelectedRaf) {
    			window.cancelAnimationFrame(addTabindexIfNoItemsSelectedRaf);
    		}
    	});

    	function addTabindexIfNoItemsSelected() {
    		let noneSelected = true;
    		let el = element;

    		while (el.nextSibling) {
    			el = el.nextSibling;

    			if (el.nodeType === 1 && el.classList.contains("mdc-list-item") && el.attributes["tabindex"] && el.attributes["tabindex"].value === "0") {
    				noneSelected = false;
    				break;
    			}
    		}

    		if (noneSelected) {
    			$$invalidate(0, tabindex = "0");
    		}
    	}

    	function action(e) {
    		if (disabled) {
    			e.preventDefault();
    		} else {
    			dispatch("SMUI:action", e);
    		}
    	}

    	function handleKeydown(e) {
    		const isEnter = e.key === "Enter" || e.keyCode === 13;
    		const isSpace = e.key === "Space" || e.keyCode === 32;

    		if (isEnter || isSpace) {
    			action(e);
    		}
    	}

    	function setChecked(isChecked) {
    		$$invalidate(10, checked = isChecked);
    		$$invalidate(0, tabindex = !nonInteractive && !disabled && (selected || checked) && "0" || "-1");
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function a_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(11, element = $$value);
    		});
    	}

    	function span_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(11, element = $$value);
    		});
    	}

    	function li_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(11, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(23, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(1, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(2, className = $$new_props.class);
    		if ("ripple" in $$new_props) $$invalidate(3, ripple = $$new_props.ripple);
    		if ("color" in $$new_props) $$invalidate(4, color = $$new_props.color);
    		if ("nonInteractive" in $$new_props) $$invalidate(17, nonInteractive = $$new_props.nonInteractive);
    		if ("activated" in $$new_props) $$invalidate(5, activated = $$new_props.activated);
    		if ("role" in $$new_props) $$invalidate(6, role = $$new_props.role);
    		if ("selected" in $$new_props) $$invalidate(7, selected = $$new_props.selected);
    		if ("disabled" in $$new_props) $$invalidate(8, disabled = $$new_props.disabled);
    		if ("tabindex" in $$new_props) $$invalidate(0, tabindex = $$new_props.tabindex);
    		if ("href" in $$new_props) $$invalidate(9, href = $$new_props.href);
    		if ("inputId" in $$new_props) $$invalidate(18, inputId = $$new_props.inputId);
    		if ("$$scope" in $$new_props) $$invalidate(24, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			counter: counter$1,
    			checked,
    			use,
    			className,
    			ripple,
    			color,
    			nonInteractive,
    			activated,
    			role,
    			selected,
    			disabled,
    			tabindex,
    			href,
    			inputId,
    			element,
    			addTabindexIfNoItemsSelectedRaf,
    			nav,
    			props
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(23, $$props = assign(assign({}, $$props), $$new_props));
    		if ("checked" in $$props) $$invalidate(10, checked = $$new_props.checked);
    		if ("use" in $$props) $$invalidate(1, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(2, className = $$new_props.className);
    		if ("ripple" in $$props) $$invalidate(3, ripple = $$new_props.ripple);
    		if ("color" in $$props) $$invalidate(4, color = $$new_props.color);
    		if ("nonInteractive" in $$props) $$invalidate(17, nonInteractive = $$new_props.nonInteractive);
    		if ("activated" in $$props) $$invalidate(5, activated = $$new_props.activated);
    		if ("role" in $$props) $$invalidate(6, role = $$new_props.role);
    		if ("selected" in $$props) $$invalidate(7, selected = $$new_props.selected);
    		if ("disabled" in $$props) $$invalidate(8, disabled = $$new_props.disabled);
    		if ("tabindex" in $$props) $$invalidate(0, tabindex = $$new_props.tabindex);
    		if ("href" in $$props) $$invalidate(9, href = $$new_props.href);
    		if ("inputId" in $$props) $$invalidate(18, inputId = $$new_props.inputId);
    		if ("element" in $$props) $$invalidate(11, element = $$new_props.element);
    		if ("addTabindexIfNoItemsSelectedRaf" in $$props) addTabindexIfNoItemsSelectedRaf = $$new_props.addTabindexIfNoItemsSelectedRaf;
    		if ("nav" in $$props) $$invalidate(14, nav = $$new_props.nav);
    		if ("props" in $$props) $$invalidate(12, props = $$new_props.props);
    	};

    	let props;

    	$$self.$$.update = () => {
    		 $$invalidate(12, props = exclude($$props, [
    			"use",
    			"class",
    			"ripple",
    			"color",
    			"nonInteractive",
    			"activated",
    			"selected",
    			"disabled",
    			"tabindex",
    			"href",
    			"inputId"
    		]));
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		tabindex,
    		use,
    		className,
    		ripple,
    		color,
    		activated,
    		role,
    		selected,
    		disabled,
    		href,
    		checked,
    		element,
    		props,
    		forwardEvents,
    		nav,
    		action,
    		handleKeydown,
    		nonInteractive,
    		inputId,
    		addTabindexIfNoItemsSelectedRaf,
    		dispatch,
    		addTabindexIfNoItemsSelected,
    		setChecked,
    		$$props,
    		$$scope,
    		$$slots,
    		a_binding,
    		span_binding,
    		li_binding
    	];
    }

    class Item extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {
    			use: 1,
    			class: 2,
    			ripple: 3,
    			color: 4,
    			nonInteractive: 17,
    			activated: 5,
    			role: 6,
    			selected: 7,
    			disabled: 8,
    			tabindex: 0,
    			href: 9,
    			inputId: 18
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Item",
    			options,
    			id: create_fragment$d.name
    		});
    	}

    	get use() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ripple() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ripple(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nonInteractive() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nonInteractive(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get activated() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set activated(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get role() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set role(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selected() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selected(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tabindex() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tabindex(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get href() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set href(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get inputId() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set inputId(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/select/Option.svelte generated by Svelte v3.16.0 */
    const file$b = "node_modules/@smui/select/Option.svelte";

    // (8:0) {:else}
    function create_else_block$6(ctx) {
    	let option;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[11], null);
    	let option_levels = [{ value: /*value*/ ctx[1] }, /*selectedProp*/ ctx[4], /*props*/ ctx[3]];
    	let option_data = {};

    	for (let i = 0; i < option_levels.length; i += 1) {
    		option_data = assign(option_data, option_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			option = element("option");
    			if (default_slot) default_slot.c();
    			set_attributes(option, option_data);
    			add_location(option, file$b, 8, 2, 144);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);

    			if (default_slot) {
    				default_slot.m(option, null);
    			}

    			useActions_action = useActions.call(null, option, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[5].call(null, option) || ({});
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 2048) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[11], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[11], dirty, null));
    			}

    			set_attributes(option, get_spread_update(option_levels, [
    				dirty & /*value*/ 2 && ({ value: /*value*/ ctx[1] }),
    				dirty & /*selectedProp*/ 16 && /*selectedProp*/ ctx[4],
    				dirty & /*props*/ 8 && /*props*/ ctx[3]
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    			if (default_slot) default_slot.d(detaching);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$6.name,
    		type: "else",
    		source: "(8:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (1:0) {#if enhanced}
    function create_if_block$7(ctx) {
    	let current;

    	const item_spread_levels = [
    		{
    			use: [/*forwardEvents*/ ctx[5], .../*use*/ ctx[0]]
    		},
    		{ "data-value": /*value*/ ctx[1] },
    		{ selected: /*selected*/ ctx[2] },
    		/*props*/ ctx[3]
    	];

    	let item_props = {
    		$$slots: { default: [create_default_slot$2] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < item_spread_levels.length; i += 1) {
    		item_props = assign(item_props, item_spread_levels[i]);
    	}

    	const item = new Item({ props: item_props, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(item.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(item, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const item_changes = dirty & /*forwardEvents, use, value, selected, props*/ 47
    			? get_spread_update(item_spread_levels, [
    					dirty & /*forwardEvents, use*/ 33 && ({
    						use: [/*forwardEvents*/ ctx[5], .../*use*/ ctx[0]]
    					}),
    					dirty & /*value*/ 2 && ({ "data-value": /*value*/ ctx[1] }),
    					dirty & /*selected*/ 4 && ({ selected: /*selected*/ ctx[2] }),
    					dirty & /*props*/ 8 && get_spread_object(/*props*/ ctx[3])
    				])
    			: {};

    			if (dirty & /*$$scope*/ 2048) {
    				item_changes.$$scope = { dirty, ctx };
    			}

    			item.$set(item_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(item.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(item.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(item, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(1:0) {#if enhanced}",
    		ctx
    	});

    	return block;
    }

    // (2:2) <Item     use={[forwardEvents, ...use]}     data-value={value}     {selected}     {...props}   >
    function create_default_slot$2(ctx) {
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[11], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 2048) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[11], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[11], dirty, null));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(2:2) <Item     use={[forwardEvents, ...use]}     data-value={value}     {selected}     {...props}   >",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$7, create_else_block$6];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*enhanced*/ ctx[6]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { value = "" } = $$props;
    	let { selected = false } = $$props;
    	let element;
    	let enhanced = getContext("SMUI:select:option:enhanced");
    	setContext("SMUI:list:item:role", "option");
    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(9, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(7, className = $$new_props.class);
    		if ("value" in $$new_props) $$invalidate(1, value = $$new_props.value);
    		if ("selected" in $$new_props) $$invalidate(2, selected = $$new_props.selected);
    		if ("$$scope" in $$new_props) $$invalidate(11, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			value,
    			selected,
    			element,
    			enhanced,
    			props,
    			selectedProp
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(9, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(7, className = $$new_props.className);
    		if ("value" in $$props) $$invalidate(1, value = $$new_props.value);
    		if ("selected" in $$props) $$invalidate(2, selected = $$new_props.selected);
    		if ("element" in $$props) element = $$new_props.element;
    		if ("enhanced" in $$props) $$invalidate(6, enhanced = $$new_props.enhanced);
    		if ("props" in $$props) $$invalidate(3, props = $$new_props.props);
    		if ("selectedProp" in $$props) $$invalidate(4, selectedProp = $$new_props.selectedProp);
    	};

    	let props;
    	let selectedProp;

    	$$self.$$.update = () => {
    		 $$invalidate(3, props = exclude($$props, ["use", "value", "selected"]));

    		if ($$self.$$.dirty & /*selected*/ 4) {
    			 $$invalidate(4, selectedProp = !enhanced && selected ? { selected: true } : {});
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		value,
    		selected,
    		props,
    		selectedProp,
    		forwardEvents,
    		enhanced,
    		className,
    		element,
    		$$props,
    		$$slots,
    		$$scope
    	];
    }

    class Option extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { use: 0, class: 7, value: 1, selected: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Option",
    			options,
    			id: create_fragment$e.name
    		});
    	}

    	get use() {
    		throw new Error("<Option>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Option>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Option>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Option>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Option>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Option>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selected() {
    		throw new Error("<Option>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selected(value) {
    		throw new Error("<Option>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/card/Card.svelte generated by Svelte v3.16.0 */
    const file$c = "node_modules/@smui/card/Card.svelte";

    function create_fragment$f(ctx) {
    	let div;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[7].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

    	let div_levels = [
    		{
    			class: "mdc-card " + /*className*/ ctx[1]
    		},
    		exclude(/*$$props*/ ctx[5], ["use", "class", "variant", "padded"])
    	];

    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_attributes(div, div_data);
    			toggle_class(div, "mdc-card--outlined", /*variant*/ ctx[2] === "outlined");
    			toggle_class(div, "smui-card--padded", /*padded*/ ctx[3]);
    			add_location(div, file$c, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			useActions_action = useActions.call(null, div, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[4].call(null, div) || ({});
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 64) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[6], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null));
    			}

    			set_attributes(div, get_spread_update(div_levels, [
    				dirty & /*className*/ 2 && ({
    					class: "mdc-card " + /*className*/ ctx[1]
    				}),
    				dirty & /*exclude, $$props*/ 32 && exclude(/*$$props*/ ctx[5], ["use", "class", "variant", "padded"])
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			toggle_class(div, "mdc-card--outlined", /*variant*/ ctx[2] === "outlined");
    			toggle_class(div, "smui-card--padded", /*padded*/ ctx[3]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { variant = "raised" } = $$props;
    	let { padded = false } = $$props;
    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("variant" in $$new_props) $$invalidate(2, variant = $$new_props.variant);
    		if ("padded" in $$new_props) $$invalidate(3, padded = $$new_props.padded);
    		if ("$$scope" in $$new_props) $$invalidate(6, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return { use, className, variant, padded };
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("variant" in $$props) $$invalidate(2, variant = $$new_props.variant);
    		if ("padded" in $$props) $$invalidate(3, padded = $$new_props.padded);
    	};

    	$$props = exclude_internal_props($$props);
    	return [use, className, variant, padded, forwardEvents, $$props, $$scope, $$slots];
    }

    class Card$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, { use: 0, class: 1, variant: 2, padded: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$f.name
    		});
    	}

    	get use() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get variant() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variant(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get padded() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set padded(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/common/ClassAdder.svelte generated by Svelte v3.16.0 */

    // (1:0) <svelte:component   this={component}   use={[forwardEvents, ...use]}   class="{smuiClass} {className}"   {...exclude($$props, ['use', 'class', 'component', 'forwardEvents'])} >
    function create_default_slot$3(ctx) {
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[8].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 512) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[9], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, null));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(1:0) <svelte:component   this={component}   use={[forwardEvents, ...use]}   class=\\\"{smuiClass} {className}\\\"   {...exclude($$props, ['use', 'class', 'component', 'forwardEvents'])} >",
    		ctx
    	});

    	return block;
    }

    function create_fragment$g(ctx) {
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{
    			use: [/*forwardEvents*/ ctx[4], .../*use*/ ctx[0]]
    		},
    		{
    			class: "" + (/*smuiClass*/ ctx[3] + " " + /*className*/ ctx[1])
    		},
    		exclude(/*$$props*/ ctx[5], ["use", "class", "component", "forwardEvents"])
    	];

    	var switch_value = /*component*/ ctx[2];

    	function switch_props(ctx) {
    		let switch_instance_props = {
    			$$slots: { default: [create_default_slot$3] },
    			$$scope: { ctx }
    		};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props(ctx));
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const switch_instance_changes = dirty & /*forwardEvents, use, smuiClass, className, exclude, $$props*/ 59
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*forwardEvents, use*/ 17 && ({
    						use: [/*forwardEvents*/ ctx[4], .../*use*/ ctx[0]]
    					}),
    					dirty & /*smuiClass, className*/ 10 && ({
    						class: "" + (/*smuiClass*/ ctx[3] + " " + /*className*/ ctx[1])
    					}),
    					dirty & /*exclude, $$props*/ 32 && get_spread_object(exclude(/*$$props*/ ctx[5], ["use", "class", "component", "forwardEvents"]))
    				])
    			: {};

    			if (dirty & /*$$scope*/ 512) {
    				switch_instance_changes.$$scope = { dirty, ctx };
    			}

    			if (switch_value !== (switch_value = /*component*/ ctx[2])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props(ctx));
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    let internals = {
    	component: null,
    	smuiClass: null,
    	contexts: {}
    };

    function instance$g($$self, $$props, $$invalidate) {
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { component = internals.component } = $$props;
    	let { forwardEvents: smuiForwardEvents = [] } = $$props;
    	const smuiClass = internals.class;
    	const contexts = internals.contexts;
    	const forwardEvents = forwardEventsBuilder(current_component, smuiForwardEvents);

    	for (let context in contexts) {
    		if (contexts.hasOwnProperty(context)) {
    			setContext(context, contexts[context]);
    		}
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("component" in $$new_props) $$invalidate(2, component = $$new_props.component);
    		if ("forwardEvents" in $$new_props) $$invalidate(6, smuiForwardEvents = $$new_props.forwardEvents);
    		if ("$$scope" in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			internals,
    			use,
    			className,
    			component,
    			smuiForwardEvents
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("component" in $$props) $$invalidate(2, component = $$new_props.component);
    		if ("smuiForwardEvents" in $$props) $$invalidate(6, smuiForwardEvents = $$new_props.smuiForwardEvents);
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		component,
    		smuiClass,
    		forwardEvents,
    		$$props,
    		smuiForwardEvents,
    		contexts,
    		$$slots,
    		$$scope
    	];
    }

    class ClassAdder extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {
    			use: 0,
    			class: 1,
    			component: 2,
    			forwardEvents: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ClassAdder",
    			options,
    			id: create_fragment$g.name
    		});
    	}

    	get use() {
    		throw new Error("<ClassAdder>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<ClassAdder>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<ClassAdder>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<ClassAdder>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<ClassAdder>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<ClassAdder>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get forwardEvents() {
    		throw new Error("<ClassAdder>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set forwardEvents(value) {
    		throw new Error("<ClassAdder>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function classAdderBuilder(props) {
      function Component(...args) {
        Object.assign(internals, props);
        return new ClassAdder(...args);
      }

      Component.prototype = ClassAdder;

      // SSR support
      if (ClassAdder.$$render) {
        Component.$$render = (...args) => Object.assign(internals, props) && ClassAdder.$$render(...args);
      }
      if (ClassAdder.render) {
        Component.render = (...args) => Object.assign(internals, props) && ClassAdder.render(...args);
      }

      return Component;
    }

    /* node_modules/@smui/common/Div.svelte generated by Svelte v3.16.0 */
    const file$d = "node_modules/@smui/common/Div.svelte";

    function create_fragment$h(ctx) {
    	let div;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);
    	let div_levels = [exclude(/*$$props*/ ctx[2], ["use"])];
    	let div_data = {};

    	for (let i = 0; i < div_levels.length; i += 1) {
    		div_data = assign(div_data, div_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_attributes(div, div_data);
    			add_location(div, file$d, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			useActions_action = useActions.call(null, div, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[1].call(null, div) || ({});
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
    			}

    			set_attributes(div, get_spread_update(div_levels, [dirty & /*exclude, $$props*/ 4 && exclude(/*$$props*/ ctx[2], ["use"])]));
    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$h($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(2, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("$$scope" in $$new_props) $$invalidate(3, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return { use };
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(2, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    	};

    	$$props = exclude_internal_props($$props);
    	return [use, forwardEvents, $$props, $$scope, $$slots];
    }

    class Div extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, { use: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Div",
    			options,
    			id: create_fragment$h.name
    		});
    	}

    	get use() {
    		throw new Error("<Div>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Div>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    classAdderBuilder({
      class: 'smui-card__content',
      component: Div,
      contexts: {}
    });

    classAdderBuilder({
      class: 'mdc-card__media-content',
      component: Div,
      contexts: {}
    });

    classAdderBuilder({
      class: 'mdc-card__action-buttons',
      component: Div,
      contexts: {}
    });

    classAdderBuilder({
      class: 'mdc-card__action-icons',
      component: Div,
      contexts: {}
    });

    /* src/components/Pannel.svelte generated by Svelte v3.16.0 */

    const { console: console_1 } = globals;
    const file$e = "src/components/Pannel.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (48:57) <Label>
    function create_default_slot_5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("new game");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5.name,
    		type: "slot",
    		source: "(48:57) <Label>",
    		ctx
    	});

    	return block;
    }

    // (48:4) <Button on:click={passStartNewGame} variant="raised">
    function create_default_slot_4$1(ctx) {
    	let current;

    	const label = new Label({
    			props: {
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(label.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(label, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const label_changes = {};

    			if (dirty & /*$$scope*/ 8192) {
    				label_changes.$$scope = { dirty, ctx };
    			}

    			label.$set(label_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(label.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(label.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(label, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4$1.name,
    		type: "slot",
    		source: "(48:4) <Button on:click={passStartNewGame} variant=\\\"raised\\\">",
    		ctx
    	});

    	return block;
    }

    // (52:8) <Option value="16">
    function create_default_slot_3$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("16");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3$1.name,
    		type: "slot",
    		source: "(52:8) <Option value=\\\"16\\\">",
    		ctx
    	});

    	return block;
    }

    // (54:12) <Option value={size} selected={selectedFieldSize === size}>
    function create_default_slot_2$1(ctx) {
    	let t_value = /*size*/ ctx[10] + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fieldSizes*/ 1 && t_value !== (t_value = /*size*/ ctx[10] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2$1.name,
    		type: "slot",
    		source: "(54:12) <Option value={size} selected={selectedFieldSize === size}>",
    		ctx
    	});

    	return block;
    }

    // (53:8) {#each fieldSizes as size}
    function create_each_block(ctx) {
    	let current;

    	const option = new Option({
    			props: {
    				value: /*size*/ ctx[10],
    				selected: /*selectedFieldSize*/ ctx[1] === /*size*/ ctx[10],
    				$$slots: { default: [create_default_slot_2$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(option.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(option, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const option_changes = {};
    			if (dirty & /*fieldSizes*/ 1) option_changes.value = /*size*/ ctx[10];
    			if (dirty & /*selectedFieldSize, fieldSizes*/ 3) option_changes.selected = /*selectedFieldSize*/ ctx[1] === /*size*/ ctx[10];

    			if (dirty & /*$$scope, fieldSizes*/ 8193) {
    				option_changes.$$scope = { dirty, ctx };
    			}

    			option.$set(option_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(option.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(option.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(option, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(53:8) {#each fieldSizes as size}",
    		ctx
    	});

    	return block;
    }

    // (51:4) <Select bind:value={selectedFieldSize} label="size">
    function create_default_slot_1$1(ctx) {
    	let t;
    	let each_1_anchor;
    	let current;

    	const option = new Option({
    			props: {
    				value: "16",
    				$$slots: { default: [create_default_slot_3$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	let each_value = /*fieldSizes*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			create_component(option.$$.fragment);
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			mount_component(option, target, anchor);
    			insert_dev(target, t, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const option_changes = {};

    			if (dirty & /*$$scope*/ 8192) {
    				option_changes.$$scope = { dirty, ctx };
    			}

    			option.$set(option_changes);

    			if (dirty & /*fieldSizes, selectedFieldSize*/ 3) {
    				each_value = /*fieldSizes*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(option.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(option.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(option, detaching);
    			if (detaching) detach_dev(t);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$1.name,
    		type: "slot",
    		source: "(51:4) <Select bind:value={selectedFieldSize} label=\\\"size\\\">",
    		ctx
    	});

    	return block;
    }

    // (46:0) <Card padded>
    function create_default_slot$4(ctx) {
    	let t0;
    	let updating_value;
    	let t1;
    	let section;
    	let strong;
    	let t2_value = formatTime(/*elapsedTime*/ ctx[2]) + "";
    	let t2;
    	let t3;
    	let div;
    	let t4_value = /*$boardState*/ ctx[3].guessedItems.length + "";
    	let t4;
    	let t5;
    	let t6_value = /*selectedFieldSize*/ ctx[1] / 2 + "";
    	let t6;
    	let current;

    	const button = new Button({
    			props: {
    				variant: "raised",
    				$$slots: { default: [create_default_slot_4$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", /*passStartNewGame*/ ctx[4]);

    	function select_value_binding(value) {
    		/*select_value_binding*/ ctx[9].call(null, value);
    	}

    	let select_props = {
    		label: "size",
    		$$slots: { default: [create_default_slot_1$1] },
    		$$scope: { ctx }
    	};

    	if (/*selectedFieldSize*/ ctx[1] !== void 0) {
    		select_props.value = /*selectedFieldSize*/ ctx[1];
    	}

    	const select = new Select({ props: select_props, $$inline: true });
    	binding_callbacks.push(() => bind(select, "value", select_value_binding));

    	const block = {
    		c: function create() {
    			create_component(button.$$.fragment);
    			t0 = space();
    			create_component(select.$$.fragment);
    			t1 = space();
    			section = element("section");
    			strong = element("strong");
    			t2 = text(t2_value);
    			t3 = space();
    			div = element("div");
    			t4 = text(t4_value);
    			t5 = text(" of ");
    			t6 = text(t6_value);
    			add_location(strong, file$e, 58, 8, 1684);
    			add_location(div, file$e, 60, 8, 1736);
    			attr_dev(section, "class", "mdc-typography--body1");
    			add_location(section, file$e, 57, 4, 1636);
    		},
    		m: function mount(target, anchor) {
    			mount_component(button, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(select, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, section, anchor);
    			append_dev(section, strong);
    			append_dev(strong, t2);
    			append_dev(section, t3);
    			append_dev(section, div);
    			append_dev(div, t4);
    			append_dev(div, t5);
    			append_dev(div, t6);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 8192) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    			const select_changes = {};

    			if (dirty & /*$$scope, fieldSizes, selectedFieldSize*/ 8195) {
    				select_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_value && dirty & /*selectedFieldSize*/ 2) {
    				updating_value = true;
    				select_changes.value = /*selectedFieldSize*/ ctx[1];
    				add_flush_callback(() => updating_value = false);
    			}

    			select.$set(select_changes);
    			if ((!current || dirty & /*elapsedTime*/ 4) && t2_value !== (t2_value = formatTime(/*elapsedTime*/ ctx[2]) + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*$boardState*/ 8) && t4_value !== (t4_value = /*$boardState*/ ctx[3].guessedItems.length + "")) set_data_dev(t4, t4_value);
    			if ((!current || dirty & /*selectedFieldSize*/ 2) && t6_value !== (t6_value = /*selectedFieldSize*/ ctx[1] / 2 + "")) set_data_dev(t6, t6_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			transition_in(select.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			transition_out(select.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(button, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(select, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(46:0) <Card padded>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$i(ctx) {
    	let current;

    	const card = new Card$1({
    			props: {
    				padded: true,
    				$$slots: { default: [create_default_slot$4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(card.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const card_changes = {};

    			if (dirty & /*$$scope, selectedFieldSize, $boardState, elapsedTime, fieldSizes*/ 8207) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(card, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function str_pad_left(string, pad, length) {
    	return (new Array(length + 1).join(pad) + string).slice(-length);
    }

    function formatTime(time) {
    	var minutes = Math.floor(time / 60);
    	var seconds = time - minutes * 60;
    	return str_pad_left(minutes, "0", 2) + ":" + str_pad_left(seconds, "0", 2);
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let $count;
    	let $boardState;
    	validate_store(count, "count");
    	component_subscribe($$self, count, $$value => $$invalidate(5, $count = $$value));
    	validate_store(boardState, "boardState");
    	component_subscribe($$self, boardState, $$value => $$invalidate(3, $boardState = $$value));
    	let fruits = ["Apple", "Orange", "Banana", "Mango"];
    	let fruitChoice = "";
    	const dispatch = createEventDispatcher();
    	let selectedFieldSize;

    	boardState.subscribe(state => {
    		if (state.guessedItems.length >= selectedFieldSize / 2 - 1) {
    			console.log("Game over", elapsedTime);
    			count.stop();
    		}
    	});

    	let { fieldSizes } = $$props;

    	function passStartNewGame() {
    		dispatch("new", { size: selectedFieldSize });
    	}

    	const writable_props = ["fieldSizes"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Pannel> was created with unknown prop '${key}'`);
    	});

    	function select_value_binding(value) {
    		selectedFieldSize = value;
    		$$invalidate(1, selectedFieldSize);
    	}

    	$$self.$set = $$props => {
    		if ("fieldSizes" in $$props) $$invalidate(0, fieldSizes = $$props.fieldSizes);
    	};

    	$$self.$capture_state = () => {
    		return {
    			fruits,
    			fruitChoice,
    			selectedFieldSize,
    			fieldSizes,
    			elapsedTime,
    			$count,
    			$boardState
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("fruits" in $$props) fruits = $$props.fruits;
    		if ("fruitChoice" in $$props) fruitChoice = $$props.fruitChoice;
    		if ("selectedFieldSize" in $$props) $$invalidate(1, selectedFieldSize = $$props.selectedFieldSize);
    		if ("fieldSizes" in $$props) $$invalidate(0, fieldSizes = $$props.fieldSizes);
    		if ("elapsedTime" in $$props) $$invalidate(2, elapsedTime = $$props.elapsedTime);
    		if ("$count" in $$props) count.set($count = $$props.$count);
    		if ("$boardState" in $$props) boardState.set($boardState = $$props.$boardState);
    	};

    	let elapsedTime;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$count, $boardState*/ 40) {
    			 $$invalidate(2, elapsedTime = parseInt(($count.getTime() - $boardState.gameStart.getTime()) / 1000));
    		}
    	};

    	return [
    		fieldSizes,
    		selectedFieldSize,
    		elapsedTime,
    		$boardState,
    		passStartNewGame,
    		$count,
    		fruits,
    		fruitChoice,
    		dispatch,
    		select_value_binding
    	];
    }

    class Pannel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$i, create_fragment$i, safe_not_equal, { fieldSizes: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Pannel",
    			options,
    			id: create_fragment$i.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (/*fieldSizes*/ ctx[0] === undefined && !("fieldSizes" in props)) {
    			console_1.warn("<Pannel> was created without expected prop 'fieldSizes'");
    		}
    	}

    	get fieldSizes() {
    		throw new Error("<Pannel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fieldSizes(value) {
    		throw new Error("<Pannel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var cardsNames = ["algiers",
        "almaty",
        "amsterdam-gvb",
        "amsterdam",
        "ankara",
        "antwerp",
        "athens-1",
        "athens",
        "atlanta",
        "baku",
        "baltimore",
        "bangalore",
        "bangkok",
        "barcelona-s",
        "barcelona",
        "beijing-mtr",
        "beijing",
        "belo-horizonte",
        "berlin-u",
        "bilbao",
        "boston",
        "brasilia",
        "brescia",
        "brussels-1",
        "bucharest",
        "budapest",
        "buenos-aires-s",
        "buffalo",
        "bursa",
        "busan",
        "cairo",
        "caracas",
        "catania",
        "changchun",
        "changsha",
        "changzhou",
        "chengdu",
        "chennai",
        "chiba",
        "chicago",
        "chongqing",
        "cleveland",
        "copenhagen",
        "daegu",
        "daejeon",
        "dalian",
        "delhi",
        "detroit",
        "dnepropetrovsk",
        "doha",
        "dongguan",
        "dubai",
        "edmonton",
        "esfahan",
        "fortaleza",
        "fukuoka",
        "fuzhou",
        "glasgow",
        "guadalajara",
        "guangzhou",
        "guiyang",
        "gwangju",
        "haifa",
        "hangzhou",
        "hanover",
        "harbin",
        "hefei",
        "helsinki",
        "hiroshima",
        "hongkong",
        "hyderabad",
        "incheon",
        "istanbul",
        "izmir",
        "jacksonville",
        "jaipur",
        "jakarta",
        "jinan",
        "kamakura",
        "kaohsiung",
        "kazan",
        "kharkov",
        "kiev",
        "kitakyushu",
        "kobe",
        "kochi",
        "kolkata",
        "kryvyi-rih",
        "kuala-lumpur",
        "kunming",
        "kyoto",
        "lanzhou",
        "las-vegas",
        "lausanne",
        "lille",
        "lima",
        "lisbon",
        "london-1",
        "los-angeles",
        "lucknow",
        "lyon",
        "madrid",
        "malaga",
        "manila",
        "maracaibo",
        "marseille",
        "mashhad",
        "medellin",
        "mexico-city",
        "miami",
        "minsk",
        "monterrey",
        "montreal",
        "moscow-lr",
        "moscow",
        "mumbai-metro",
        "nagoya",
        "naha",
        "nanchang",
        "nanjing",
        "nanning",
        "new-york",
        "newark",
        "newcastle",
        "ningbo",
        "nizhniy-novgorod",
        "novosibirsk",
        "osaka",
        "oslo",
        "palma",
        "panama-city",
        "paris",
        "perugia",
        "philadelphia-patco",
        "philadelphia",
        "pittsburgh",
        "porto-alegre",
        "porto",
        "poznan",
        "prague",
        "pyongyang",
        "qingdao",
        "recife",
        "rennes",
        "rhein-ruhr",
        "rio-de-janeiro",
        "rome-official",
        "rome",
        "rotterdam",
        "rouen",
        "saint-louis",
        "salvador",
        "samara",
        "san-francisco",
        "san-juan",
        "santiago",
        "santo-domingo",
        "sao-paulo-4",
        "sao-paulo",
        "sapporo",
        "seattle",
        "sendai",
        "seoul-smrt",
        "seoul",
        "sevilla",
        "shanghai",
        "shenyang",
        "shenzhen",
        "shijiazhuang",
        "singapore",
        "sofia",
        "st-petersburg",
        "stockholm",
        "stuttgart",
        "suzhou",
        "sydney-metro",
        "tabriz",
        "taipei",
        "tama",
        "taoyuan",
        "tashkent",
        "tbilisi",
        "tehran",
        "the-hague",
        "tianjin",
        "tokyo-toei",
        "tokyo",
        "toronto",
        "toulouse",
        "urumqi",
        "valencia-es",
        "valencia-venezuela",
        "valparaiso",
        "vancouver",
        "vienna-u",
        "volgograd",
        "warsaw",
        "washington",
        "wenzhou",
        "wuhan",
        "wuppertal",
        "wuxi",
        "xiamen",
        "xian",
        "xuzhou",
        "yekaterinburg",
        "yerevan",
        "yokohama-minatomirai",
        "yokohama",
        "zhengzhou"];

    /* src/routes/index.svelte generated by Svelte v3.16.0 */
    const file$f = "src/routes/index.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (106:1) {#if cards}
    function create_if_block$8(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*cards*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*cards, checkAmount*/ 18) {
    				each_value = /*cards*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(106:1) {#if cards}",
    		ctx
    	});

    	return block;
    }

    // (107:2) {#each cards as card}
    function create_each_block$1(ctx) {
    	let current;

    	const card = new Card({
    			props: {
    				symbol: `assets/logos/${/*card*/ ctx[10]}.gif`
    			},
    			$$inline: true
    		});

    	card.$on("turn", /*checkAmount*/ ctx[4]);

    	const block = {
    		c: function create() {
    			create_component(card.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const card_changes = {};
    			if (dirty & /*cards*/ 2) card_changes.symbol = `assets/logos/${/*card*/ ctx[10]}.gif`;
    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(card, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(107:2) {#each cards as card}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$j(ctx) {
    	let t;
    	let section;
    	let current;

    	const pannel = new Pannel({
    			props: { fieldSizes: /*fieldSizes*/ ctx[2] },
    			$$inline: true
    		});

    	pannel.$on("new", /*startNewGame*/ ctx[3]);
    	let if_block = /*cards*/ ctx[1] && create_if_block$8(ctx);

    	const block = {
    		c: function create() {
    			create_component(pannel.$$.fragment);
    			t = space();
    			section = element("section");
    			if (if_block) if_block.c();
    			attr_dev(section, "class", "game-board svelte-16qasmo");
    			toggle_class(section, "sizeBig", /*isBigSize*/ ctx[0]);
    			add_location(section, file$f, 104, 0, 2352);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(pannel, target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, section, anchor);
    			if (if_block) if_block.m(section, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*cards*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block$8(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(section, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*isBigSize*/ 1) {
    				toggle_class(section, "sizeBig", /*isBigSize*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(pannel.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(pannel.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(pannel, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(section);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getRandomInt(max) {
    	return Math.floor(Math.random() * Math.floor(max));
    }

    function instance$j($$self, $$props, $$invalidate) {
    	let $boardState;
    	validate_store(boardState, "boardState");
    	component_subscribe($$self, boardState, $$value => $$invalidate(6, $boardState = $$value));
    	const dispatch = createEventDispatcher();
    	const fieldSizes = [16, 36, 100];

    	let selectedFieldSize = fieldSizes[0];
    	let isBigSize = false;
    	let cards;

    	onMount(async () => {
    		restart();
    	});

    	function startNewGame(event) {
    		selectedFieldSize = event.detail.size;
    		$$invalidate(1, cards = []);

    		setTimeout(() => {
    			restart();
    		});
    	}

    	function restart() {
    		$$invalidate(0, isBigSize = selectedFieldSize > 20);

    		boardState.update(_ => ({
    			...defaultState,
    			guessedItems: [],
    			gameStart: new Date()
    		}));

    		let start = getRandomInt(cardsNames.length);
    		let cardsGroup = cardsNames.slice(start, start + selectedFieldSize / 2);

    		if (cardsNames.length - start < selectedFieldSize / 2) {
    			const leftFromFront = selectedFieldSize / 2 - cardsNames.length + start;
    			cardsGroup = cardsGroup.concat(cardsNames.slice(0, leftFromFront));
    		}

    		$$invalidate(1, cards = [...cardsGroup, ...cardsGroup].sort(() => Math.random() - 0.5));
    	}

    	function checkAmount() {
    		if ($boardState.openedItems.length > 1 && $boardState.openedItems[0] === $boardState.openedItems[1]) {
    			boardState.update(state => {
    				const newState = {
    					guessedItems: $boardState.guessedItems.length
    					? [...$boardState.guessedItems, $boardState.openedItems[1]]
    					: [$boardState.openedItems[1]],
    					toRemove: null,
    					openedItems: [],
    					gameStart: state.gameStart
    				};

    				return newState;
    			});
    		} else {
    			if ($boardState.openedItems.length > 1) {
    				boardState.update(state => {
    					const newState = {
    						toRemove: $boardState.openedItems[0],
    						openedItems: $boardState.openedItems.splice(1, 3),
    						guessedItems: $boardState.guessedItems,
    						gameStart: $boardState.gameStart
    					};

    					return newState;
    				});
    			}
    		}
    	}

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("selectedFieldSize" in $$props) selectedFieldSize = $$props.selectedFieldSize;
    		if ("isBigSize" in $$props) $$invalidate(0, isBigSize = $$props.isBigSize);
    		if ("cards" in $$props) $$invalidate(1, cards = $$props.cards);
    		if ("$boardState" in $$props) boardState.set($boardState = $$props.$boardState);
    	};

    	return [isBigSize, cards, fieldSizes, startNewGame, checkAmount];
    }

    class Routes extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Routes",
    			options,
    			id: create_fragment$j.name
    		});
    	}
    }

    /* src/routes/about.svelte generated by Svelte v3.16.0 */

    const file$g = "src/routes/about.svelte";

    function create_fragment$k(ctx) {
    	let h3;
    	let t1;
    	let section;
    	let p0;
    	let t3;
    	let p1;
    	let a;
    	let t5;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Cards game";
    			t1 = space();
    			section = element("section");
    			p0 = element("p");
    			p0.textContent = "Sample ap built with Sapper + Svelte";
    			t3 = space();
    			p1 = element("p");
    			a = element("a");
    			a.textContent = "metro logos";
    			t5 = text(" from mic-ro.com");
    			attr_dev(h3, "class", "mdc-typography--headline3");
    			add_location(h3, file$g, 0, 0, 0);
    			add_location(p0, file$g, 2, 4, 98);
    			attr_dev(a, "href", "http://mic-ro.com/metro/metrologos.html?size=lg&sort=city");
    			add_location(a, file$g, 3, 7, 149);
    			add_location(p1, file$g, 3, 4, 146);
    			attr_dev(section, "class", "mdc-typography--body1");
    			add_location(section, file$g, 1, 0, 54);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, section, anchor);
    			append_dev(section, p0);
    			append_dev(section, t3);
    			append_dev(section, p1);
    			append_dev(p1, a);
    			append_dev(p1, t5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$k, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$k.name
    		});
    	}
    }

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$9 = {
        FIXED_CLASS: 'mdc-top-app-bar--fixed',
        FIXED_SCROLLED_CLASS: 'mdc-top-app-bar--fixed-scrolled',
        SHORT_CLASS: 'mdc-top-app-bar--short',
        SHORT_COLLAPSED_CLASS: 'mdc-top-app-bar--short-collapsed',
        SHORT_HAS_ACTION_ITEM_CLASS: 'mdc-top-app-bar--short-has-action-item',
    };
    var numbers$6 = {
        DEBOUNCE_THROTTLE_RESIZE_TIME_MS: 100,
        MAX_TOP_APP_BAR_HEIGHT: 128,
    };
    var strings$8 = {
        ACTION_ITEM_SELECTOR: '.mdc-top-app-bar__action-item',
        NAVIGATION_EVENT: 'MDCTopAppBar:nav',
        NAVIGATION_ICON_SELECTOR: '.mdc-top-app-bar__navigation-icon',
        ROOT_SELECTOR: '.mdc-top-app-bar',
        TITLE_SELECTOR: '.mdc-top-app-bar__title',
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCTopAppBarBaseFoundation = /** @class */ (function (_super) {
        __extends(MDCTopAppBarBaseFoundation, _super);
        /* istanbul ignore next: optional argument is not a branch statement */
        function MDCTopAppBarBaseFoundation(adapter) {
            return _super.call(this, __assign({}, MDCTopAppBarBaseFoundation.defaultAdapter, adapter)) || this;
        }
        Object.defineProperty(MDCTopAppBarBaseFoundation, "strings", {
            get: function () {
                return strings$8;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCTopAppBarBaseFoundation, "cssClasses", {
            get: function () {
                return cssClasses$9;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCTopAppBarBaseFoundation, "numbers", {
            get: function () {
                return numbers$6;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCTopAppBarBaseFoundation, "defaultAdapter", {
            /**
             * See {@link MDCTopAppBarAdapter} for typing information on parameters and return types.
             */
            get: function () {
                // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
                return {
                    addClass: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    hasClass: function () { return false; },
                    setStyle: function () { return undefined; },
                    getTopAppBarHeight: function () { return 0; },
                    notifyNavigationIconClicked: function () { return undefined; },
                    getViewportScrollY: function () { return 0; },
                    getTotalActionItems: function () { return 0; },
                };
                // tslint:enable:object-literal-sort-keys
            },
            enumerable: true,
            configurable: true
        });
        /** Other variants of TopAppBar foundation overrides this method */
        MDCTopAppBarBaseFoundation.prototype.handleTargetScroll = function () { }; // tslint:disable-line:no-empty
        /** Other variants of TopAppBar foundation overrides this method */
        MDCTopAppBarBaseFoundation.prototype.handleWindowResize = function () { }; // tslint:disable-line:no-empty
        MDCTopAppBarBaseFoundation.prototype.handleNavigationClick = function () {
            this.adapter_.notifyNavigationIconClicked();
        };
        return MDCTopAppBarBaseFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var INITIAL_VALUE = 0;
    var MDCTopAppBarFoundation = /** @class */ (function (_super) {
        __extends(MDCTopAppBarFoundation, _super);
        /* istanbul ignore next: optional argument is not a branch statement */
        function MDCTopAppBarFoundation(adapter) {
            var _this = _super.call(this, adapter) || this;
            /**
             * Indicates if the top app bar was docked in the previous scroll handler iteration.
             */
            _this.wasDocked_ = true;
            /**
             * Indicates if the top app bar is docked in the fully shown position.
             */
            _this.isDockedShowing_ = true;
            /**
             * Variable for current scroll position of the top app bar
             */
            _this.currentAppBarOffsetTop_ = 0;
            /**
             * Used to prevent the top app bar from being scrolled out of view during resize events
             */
            _this.isCurrentlyBeingResized_ = false;
            /**
             * The timeout that's used to throttle the resize events
             */
            _this.resizeThrottleId_ = INITIAL_VALUE;
            /**
             * The timeout that's used to debounce toggling the isCurrentlyBeingResized_ variable after a resize
             */
            _this.resizeDebounceId_ = INITIAL_VALUE;
            _this.lastScrollPosition_ = _this.adapter_.getViewportScrollY();
            _this.topAppBarHeight_ = _this.adapter_.getTopAppBarHeight();
            return _this;
        }
        MDCTopAppBarFoundation.prototype.destroy = function () {
            _super.prototype.destroy.call(this);
            this.adapter_.setStyle('top', '');
        };
        /**
         * Scroll handler for the default scroll behavior of the top app bar.
         * @override
         */
        MDCTopAppBarFoundation.prototype.handleTargetScroll = function () {
            var currentScrollPosition = Math.max(this.adapter_.getViewportScrollY(), 0);
            var diff = currentScrollPosition - this.lastScrollPosition_;
            this.lastScrollPosition_ = currentScrollPosition;
            // If the window is being resized the lastScrollPosition_ needs to be updated but the
            // current scroll of the top app bar should stay in the same position.
            if (!this.isCurrentlyBeingResized_) {
                this.currentAppBarOffsetTop_ -= diff;
                if (this.currentAppBarOffsetTop_ > 0) {
                    this.currentAppBarOffsetTop_ = 0;
                }
                else if (Math.abs(this.currentAppBarOffsetTop_) > this.topAppBarHeight_) {
                    this.currentAppBarOffsetTop_ = -this.topAppBarHeight_;
                }
                this.moveTopAppBar_();
            }
        };
        /**
         * Top app bar resize handler that throttle/debounce functions that execute updates.
         * @override
         */
        MDCTopAppBarFoundation.prototype.handleWindowResize = function () {
            var _this = this;
            // Throttle resize events 10 p/s
            if (!this.resizeThrottleId_) {
                this.resizeThrottleId_ = setTimeout(function () {
                    _this.resizeThrottleId_ = INITIAL_VALUE;
                    _this.throttledResizeHandler_();
                }, numbers$6.DEBOUNCE_THROTTLE_RESIZE_TIME_MS);
            }
            this.isCurrentlyBeingResized_ = true;
            if (this.resizeDebounceId_) {
                clearTimeout(this.resizeDebounceId_);
            }
            this.resizeDebounceId_ = setTimeout(function () {
                _this.handleTargetScroll();
                _this.isCurrentlyBeingResized_ = false;
                _this.resizeDebounceId_ = INITIAL_VALUE;
            }, numbers$6.DEBOUNCE_THROTTLE_RESIZE_TIME_MS);
        };
        /**
         * Function to determine if the DOM needs to update.
         */
        MDCTopAppBarFoundation.prototype.checkForUpdate_ = function () {
            var offscreenBoundaryTop = -this.topAppBarHeight_;
            var hasAnyPixelsOffscreen = this.currentAppBarOffsetTop_ < 0;
            var hasAnyPixelsOnscreen = this.currentAppBarOffsetTop_ > offscreenBoundaryTop;
            var partiallyShowing = hasAnyPixelsOffscreen && hasAnyPixelsOnscreen;
            // If it's partially showing, it can't be docked.
            if (partiallyShowing) {
                this.wasDocked_ = false;
            }
            else {
                // Not previously docked and not partially showing, it's now docked.
                if (!this.wasDocked_) {
                    this.wasDocked_ = true;
                    return true;
                }
                else if (this.isDockedShowing_ !== hasAnyPixelsOnscreen) {
                    this.isDockedShowing_ = hasAnyPixelsOnscreen;
                    return true;
                }
            }
            return partiallyShowing;
        };
        /**
         * Function to move the top app bar if needed.
         */
        MDCTopAppBarFoundation.prototype.moveTopAppBar_ = function () {
            if (this.checkForUpdate_()) {
                // Once the top app bar is fully hidden we use the max potential top app bar height as our offset
                // so the top app bar doesn't show if the window resizes and the new height > the old height.
                var offset = this.currentAppBarOffsetTop_;
                if (Math.abs(offset) >= this.topAppBarHeight_) {
                    offset = -numbers$6.MAX_TOP_APP_BAR_HEIGHT;
                }
                this.adapter_.setStyle('top', offset + 'px');
            }
        };
        /**
         * Throttled function that updates the top app bar scrolled values if the
         * top app bar height changes.
         */
        MDCTopAppBarFoundation.prototype.throttledResizeHandler_ = function () {
            var currentHeight = this.adapter_.getTopAppBarHeight();
            if (this.topAppBarHeight_ !== currentHeight) {
                this.wasDocked_ = false;
                // Since the top app bar has a different height depending on the screen width, this
                // will ensure that the top app bar remains in the correct location if
                // completely hidden and a resize makes the top app bar a different height.
                this.currentAppBarOffsetTop_ -= this.topAppBarHeight_ - currentHeight;
                this.topAppBarHeight_ = currentHeight;
            }
            this.handleTargetScroll();
        };
        return MDCTopAppBarFoundation;
    }(MDCTopAppBarBaseFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCFixedTopAppBarFoundation = /** @class */ (function (_super) {
        __extends(MDCFixedTopAppBarFoundation, _super);
        function MDCFixedTopAppBarFoundation() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            /**
             * State variable for the previous scroll iteration top app bar state
             */
            _this.wasScrolled_ = false;
            return _this;
        }
        /**
         * Scroll handler for applying/removing the modifier class on the fixed top app bar.
         * @override
         */
        MDCFixedTopAppBarFoundation.prototype.handleTargetScroll = function () {
            var currentScroll = this.adapter_.getViewportScrollY();
            if (currentScroll <= 0) {
                if (this.wasScrolled_) {
                    this.adapter_.removeClass(cssClasses$9.FIXED_SCROLLED_CLASS);
                    this.wasScrolled_ = false;
                }
            }
            else {
                if (!this.wasScrolled_) {
                    this.adapter_.addClass(cssClasses$9.FIXED_SCROLLED_CLASS);
                    this.wasScrolled_ = true;
                }
            }
        };
        return MDCFixedTopAppBarFoundation;
    }(MDCTopAppBarFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCShortTopAppBarFoundation = /** @class */ (function (_super) {
        __extends(MDCShortTopAppBarFoundation, _super);
        /* istanbul ignore next: optional argument is not a branch statement */
        function MDCShortTopAppBarFoundation(adapter) {
            var _this = _super.call(this, adapter) || this;
            _this.isCollapsed_ = false;
            _this.isAlwaysCollapsed_ = false;
            return _this;
        }
        Object.defineProperty(MDCShortTopAppBarFoundation.prototype, "isCollapsed", {
            // Public visibility for backward compatibility.
            get: function () {
                return this.isCollapsed_;
            },
            enumerable: true,
            configurable: true
        });
        MDCShortTopAppBarFoundation.prototype.init = function () {
            _super.prototype.init.call(this);
            if (this.adapter_.getTotalActionItems() > 0) {
                this.adapter_.addClass(cssClasses$9.SHORT_HAS_ACTION_ITEM_CLASS);
            }
            // If initialized with SHORT_COLLAPSED_CLASS, the bar should always be collapsed
            this.setAlwaysCollapsed(this.adapter_.hasClass(cssClasses$9.SHORT_COLLAPSED_CLASS));
        };
        /**
         * Set if the short top app bar should always be collapsed.
         *
         * @param value When `true`, bar will always be collapsed. When `false`, bar may collapse or expand based on scroll.
         */
        MDCShortTopAppBarFoundation.prototype.setAlwaysCollapsed = function (value) {
            this.isAlwaysCollapsed_ = !!value;
            if (this.isAlwaysCollapsed_) {
                this.collapse_();
            }
            else {
                // let maybeCollapseBar_ determine if the bar should be collapsed
                this.maybeCollapseBar_();
            }
        };
        MDCShortTopAppBarFoundation.prototype.getAlwaysCollapsed = function () {
            return this.isAlwaysCollapsed_;
        };
        /**
         * Scroll handler for applying/removing the collapsed modifier class on the short top app bar.
         * @override
         */
        MDCShortTopAppBarFoundation.prototype.handleTargetScroll = function () {
            this.maybeCollapseBar_();
        };
        MDCShortTopAppBarFoundation.prototype.maybeCollapseBar_ = function () {
            if (this.isAlwaysCollapsed_) {
                return;
            }
            var currentScroll = this.adapter_.getViewportScrollY();
            if (currentScroll <= 0) {
                if (this.isCollapsed_) {
                    this.uncollapse_();
                }
            }
            else {
                if (!this.isCollapsed_) {
                    this.collapse_();
                }
            }
        };
        MDCShortTopAppBarFoundation.prototype.uncollapse_ = function () {
            this.adapter_.removeClass(cssClasses$9.SHORT_COLLAPSED_CLASS);
            this.isCollapsed_ = false;
        };
        MDCShortTopAppBarFoundation.prototype.collapse_ = function () {
            this.adapter_.addClass(cssClasses$9.SHORT_COLLAPSED_CLASS);
            this.isCollapsed_ = true;
        };
        return MDCShortTopAppBarFoundation;
    }(MDCTopAppBarBaseFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCTopAppBar = /** @class */ (function (_super) {
        __extends(MDCTopAppBar, _super);
        function MDCTopAppBar() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        MDCTopAppBar.attachTo = function (root) {
            return new MDCTopAppBar(root);
        };
        MDCTopAppBar.prototype.initialize = function (rippleFactory) {
            if (rippleFactory === void 0) { rippleFactory = function (el) { return MDCRipple.attachTo(el); }; }
            this.navIcon_ = this.root_.querySelector(strings$8.NAVIGATION_ICON_SELECTOR);
            // Get all icons in the toolbar and instantiate the ripples
            var icons = [].slice.call(this.root_.querySelectorAll(strings$8.ACTION_ITEM_SELECTOR));
            if (this.navIcon_) {
                icons.push(this.navIcon_);
            }
            this.iconRipples_ = icons.map(function (icon) {
                var ripple = rippleFactory(icon);
                ripple.unbounded = true;
                return ripple;
            });
            this.scrollTarget_ = window;
        };
        MDCTopAppBar.prototype.initialSyncWithDOM = function () {
            this.handleNavigationClick_ = this.foundation_.handleNavigationClick.bind(this.foundation_);
            this.handleWindowResize_ = this.foundation_.handleWindowResize.bind(this.foundation_);
            this.handleTargetScroll_ = this.foundation_.handleTargetScroll.bind(this.foundation_);
            this.scrollTarget_.addEventListener('scroll', this.handleTargetScroll_);
            if (this.navIcon_) {
                this.navIcon_.addEventListener('click', this.handleNavigationClick_);
            }
            var isFixed = this.root_.classList.contains(cssClasses$9.FIXED_CLASS);
            var isShort = this.root_.classList.contains(cssClasses$9.SHORT_CLASS);
            if (!isShort && !isFixed) {
                window.addEventListener('resize', this.handleWindowResize_);
            }
        };
        MDCTopAppBar.prototype.destroy = function () {
            this.iconRipples_.forEach(function (iconRipple) { return iconRipple.destroy(); });
            this.scrollTarget_.removeEventListener('scroll', this.handleTargetScroll_);
            if (this.navIcon_) {
                this.navIcon_.removeEventListener('click', this.handleNavigationClick_);
            }
            var isFixed = this.root_.classList.contains(cssClasses$9.FIXED_CLASS);
            var isShort = this.root_.classList.contains(cssClasses$9.SHORT_CLASS);
            if (!isShort && !isFixed) {
                window.removeEventListener('resize', this.handleWindowResize_);
            }
            _super.prototype.destroy.call(this);
        };
        MDCTopAppBar.prototype.setScrollTarget = function (target) {
            // Remove scroll handler from the previous scroll target
            this.scrollTarget_.removeEventListener('scroll', this.handleTargetScroll_);
            this.scrollTarget_ = target;
            // Initialize scroll handler on the new scroll target
            this.handleTargetScroll_ =
                this.foundation_.handleTargetScroll.bind(this.foundation_);
            this.scrollTarget_.addEventListener('scroll', this.handleTargetScroll_);
        };
        MDCTopAppBar.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
            var adapter = {
                hasClass: function (className) { return _this.root_.classList.contains(className); },
                addClass: function (className) { return _this.root_.classList.add(className); },
                removeClass: function (className) { return _this.root_.classList.remove(className); },
                setStyle: function (property, value) { return _this.root_.style.setProperty(property, value); },
                getTopAppBarHeight: function () { return _this.root_.clientHeight; },
                notifyNavigationIconClicked: function () { return _this.emit(strings$8.NAVIGATION_EVENT, {}); },
                getViewportScrollY: function () {
                    var win = _this.scrollTarget_;
                    var el = _this.scrollTarget_;
                    return win.pageYOffset !== undefined ? win.pageYOffset : el.scrollTop;
                },
                getTotalActionItems: function () { return _this.root_.querySelectorAll(strings$8.ACTION_ITEM_SELECTOR).length; },
            };
            // tslint:enable:object-literal-sort-keys
            var foundation;
            if (this.root_.classList.contains(cssClasses$9.SHORT_CLASS)) {
                foundation = new MDCShortTopAppBarFoundation(adapter);
            }
            else if (this.root_.classList.contains(cssClasses$9.FIXED_CLASS)) {
                foundation = new MDCFixedTopAppBarFoundation(adapter);
            }
            else {
                foundation = new MDCTopAppBarFoundation(adapter);
            }
            return foundation;
        };
        return MDCTopAppBar;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /* node_modules/@smui/top-app-bar/TopAppBar.svelte generated by Svelte v3.16.0 */
    const file$h = "node_modules/@smui/top-app-bar/TopAppBar.svelte";

    function create_fragment$l(ctx) {
    	let header;
    	let forwardEvents_action;
    	let useActions_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[12].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[11], null);

    	let header_levels = [
    		exclude(/*$$props*/ ctx[9], ["use", "class", "variant", "color", "collapsed", "prominent", "dense"]),
    		{
    			class: "mdc-top-app-bar " + /*className*/ ctx[1]
    		}
    	];

    	let header_data = {};

    	for (let i = 0; i < header_levels.length; i += 1) {
    		header_data = assign(header_data, header_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			header = element("header");
    			if (default_slot) default_slot.c();
    			set_attributes(header, header_data);
    			toggle_class(header, "mdc-top-app-bar--fixed", /*variant*/ ctx[2] === "fixed");
    			toggle_class(header, "mdc-top-app-bar--short", /*variant*/ ctx[2] === "short");
    			toggle_class(header, "mdc-top-app-bar--short-collapsed", /*collapsed*/ ctx[4]);
    			toggle_class(header, "smui-top-app-bar--static", /*variant*/ ctx[2] === "static");
    			toggle_class(header, "smui-top-app-bar--color-secondary", /*color*/ ctx[3] === "secondary");
    			toggle_class(header, "mdc-top-app-bar--prominent", /*prominent*/ ctx[5]);
    			toggle_class(header, "mdc-top-app-bar--dense", /*dense*/ ctx[6]);
    			add_location(header, file$h, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);

    			if (default_slot) {
    				default_slot.m(header, null);
    			}

    			/*header_binding*/ ctx[13](header);
    			forwardEvents_action = /*forwardEvents*/ ctx[8].call(null, header) || ({});
    			useActions_action = useActions.call(null, header, /*use*/ ctx[0]) || ({});
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 2048) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[11], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[11], dirty, null));
    			}

    			set_attributes(header, get_spread_update(header_levels, [
    				dirty & /*exclude, $$props*/ 512 && exclude(/*$$props*/ ctx[9], ["use", "class", "variant", "color", "collapsed", "prominent", "dense"]),
    				dirty & /*className*/ 2 && ({
    					class: "mdc-top-app-bar " + /*className*/ ctx[1]
    				})
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			toggle_class(header, "mdc-top-app-bar--fixed", /*variant*/ ctx[2] === "fixed");
    			toggle_class(header, "mdc-top-app-bar--short", /*variant*/ ctx[2] === "short");
    			toggle_class(header, "mdc-top-app-bar--short-collapsed", /*collapsed*/ ctx[4]);
    			toggle_class(header, "smui-top-app-bar--static", /*variant*/ ctx[2] === "static");
    			toggle_class(header, "smui-top-app-bar--color-secondary", /*color*/ ctx[3] === "secondary");
    			toggle_class(header, "mdc-top-app-bar--prominent", /*prominent*/ ctx[5]);
    			toggle_class(header, "mdc-top-app-bar--dense", /*dense*/ ctx[6]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (default_slot) default_slot.d(detaching);
    			/*header_binding*/ ctx[13](null);
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$k($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component, ["MDCList:action"]);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { variant = "standard" } = $$props;
    	let { color = "primary" } = $$props;
    	let { collapsed = false } = $$props;
    	let { prominent = false } = $$props;
    	let { dense = false } = $$props;
    	let element;
    	let topAppBar;

    	onMount(() => {
    		topAppBar = new MDCTopAppBar(element);
    	});

    	onDestroy(() => {
    		topAppBar && topAppBar.destroy();
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	function header_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(7, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(9, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("variant" in $$new_props) $$invalidate(2, variant = $$new_props.variant);
    		if ("color" in $$new_props) $$invalidate(3, color = $$new_props.color);
    		if ("collapsed" in $$new_props) $$invalidate(4, collapsed = $$new_props.collapsed);
    		if ("prominent" in $$new_props) $$invalidate(5, prominent = $$new_props.prominent);
    		if ("dense" in $$new_props) $$invalidate(6, dense = $$new_props.dense);
    		if ("$$scope" in $$new_props) $$invalidate(11, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			variant,
    			color,
    			collapsed,
    			prominent,
    			dense,
    			element,
    			topAppBar
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(9, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("variant" in $$props) $$invalidate(2, variant = $$new_props.variant);
    		if ("color" in $$props) $$invalidate(3, color = $$new_props.color);
    		if ("collapsed" in $$props) $$invalidate(4, collapsed = $$new_props.collapsed);
    		if ("prominent" in $$props) $$invalidate(5, prominent = $$new_props.prominent);
    		if ("dense" in $$props) $$invalidate(6, dense = $$new_props.dense);
    		if ("element" in $$props) $$invalidate(7, element = $$new_props.element);
    		if ("topAppBar" in $$props) topAppBar = $$new_props.topAppBar;
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		variant,
    		color,
    		collapsed,
    		prominent,
    		dense,
    		element,
    		forwardEvents,
    		$$props,
    		topAppBar,
    		$$scope,
    		$$slots,
    		header_binding
    	];
    }

    class TopAppBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$k, create_fragment$l, safe_not_equal, {
    			use: 0,
    			class: 1,
    			variant: 2,
    			color: 3,
    			collapsed: 4,
    			prominent: 5,
    			dense: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TopAppBar",
    			options,
    			id: create_fragment$l.name
    		});
    	}

    	get use() {
    		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get variant() {
    		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variant(value) {
    		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get collapsed() {
    		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set collapsed(value) {
    		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get prominent() {
    		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set prominent(value) {
    		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dense() {
    		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dense(value) {
    		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var Row = classAdderBuilder({
      class: 'mdc-top-app-bar__row',
      component: Div,
      contexts: {}
    });

    /* node_modules/@smui/top-app-bar/Section.svelte generated by Svelte v3.16.0 */
    const file$i = "node_modules/@smui/top-app-bar/Section.svelte";

    function create_fragment$m(ctx) {
    	let section;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[8].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);

    	let section_levels = [
    		{
    			class: "mdc-top-app-bar__section " + /*className*/ ctx[1]
    		},
    		/*roleProp*/ ctx[3],
    		exclude(/*$$props*/ ctx[5], ["use", "class", "align", "toolbar"])
    	];

    	let section_data = {};

    	for (let i = 0; i < section_levels.length; i += 1) {
    		section_data = assign(section_data, section_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			if (default_slot) default_slot.c();
    			set_attributes(section, section_data);
    			toggle_class(section, "mdc-top-app-bar__section--align-start", /*align*/ ctx[2] === "start");
    			toggle_class(section, "mdc-top-app-bar__section--align-end", /*align*/ ctx[2] === "end");
    			add_location(section, file$i, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);

    			if (default_slot) {
    				default_slot.m(section, null);
    			}

    			useActions_action = useActions.call(null, section, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[4].call(null, section) || ({});
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 128) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[7], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, null));
    			}

    			set_attributes(section, get_spread_update(section_levels, [
    				dirty & /*className*/ 2 && ({
    					class: "mdc-top-app-bar__section " + /*className*/ ctx[1]
    				}),
    				dirty & /*roleProp*/ 8 && /*roleProp*/ ctx[3],
    				dirty & /*exclude, $$props*/ 32 && exclude(/*$$props*/ ctx[5], ["use", "class", "align", "toolbar"])
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    			toggle_class(section, "mdc-top-app-bar__section--align-start", /*align*/ ctx[2] === "start");
    			toggle_class(section, "mdc-top-app-bar__section--align-end", /*align*/ ctx[2] === "end");
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (default_slot) default_slot.d(detaching);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$m.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$l($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component, ["MDCList:action"]);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { align = "start" } = $$props;
    	let { toolbar = false } = $$props;

    	setContext("SMUI:icon-button:context", toolbar
    	? "top-app-bar:action"
    	: "top-app-bar:navigation");

    	setContext("SMUI:button:context", toolbar
    	? "top-app-bar:action"
    	: "top-app-bar:navigation");

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
    		if ("align" in $$new_props) $$invalidate(2, align = $$new_props.align);
    		if ("toolbar" in $$new_props) $$invalidate(6, toolbar = $$new_props.toolbar);
    		if ("$$scope" in $$new_props) $$invalidate(7, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return { use, className, align, toolbar, roleProp };
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
    		if ("align" in $$props) $$invalidate(2, align = $$new_props.align);
    		if ("toolbar" in $$props) $$invalidate(6, toolbar = $$new_props.toolbar);
    		if ("roleProp" in $$props) $$invalidate(3, roleProp = $$new_props.roleProp);
    	};

    	let roleProp;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*toolbar*/ 64) {
    			 $$invalidate(3, roleProp = toolbar ? { role: "toolbar" } : {});
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		use,
    		className,
    		align,
    		roleProp,
    		forwardEvents,
    		$$props,
    		toolbar,
    		$$scope,
    		$$slots
    	];
    }

    class Section extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$l, create_fragment$m, safe_not_equal, { use: 0, class: 1, align: 2, toolbar: 6 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Section",
    			options,
    			id: create_fragment$m.name
    		});
    	}

    	get use() {
    		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get align() {
    		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set align(value) {
    		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toolbar() {
    		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toolbar(value) {
    		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@smui/common/Span.svelte generated by Svelte v3.16.0 */
    const file$j = "node_modules/@smui/common/Span.svelte";

    function create_fragment$n(ctx) {
    	let span;
    	let useActions_action;
    	let forwardEvents_action;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);
    	let span_levels = [exclude(/*$$props*/ ctx[2], ["use"])];
    	let span_data = {};

    	for (let i = 0; i < span_levels.length; i += 1) {
    		span_data = assign(span_data, span_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			span = element("span");
    			if (default_slot) default_slot.c();
    			set_attributes(span, span_data);
    			add_location(span, file$j, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);

    			if (default_slot) {
    				default_slot.m(span, null);
    			}

    			useActions_action = useActions.call(null, span, /*use*/ ctx[0]) || ({});
    			forwardEvents_action = /*forwardEvents*/ ctx[1].call(null, span) || ({});
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
    			}

    			set_attributes(span, get_spread_update(span_levels, [dirty & /*exclude, $$props*/ 4 && exclude(/*$$props*/ ctx[2], ["use"])]));
    			if (is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (default_slot) default_slot.d(detaching);
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$n.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$m($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component);
    	let { use = [] } = $$props;
    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate(2, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
    		if ("$$scope" in $$new_props) $$invalidate(3, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return { use };
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(2, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
    	};

    	$$props = exclude_internal_props($$props);
    	return [use, forwardEvents, $$props, $$scope, $$slots];
    }

    class Span extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$m, create_fragment$n, safe_not_equal, { use: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Span",
    			options,
    			id: create_fragment$n.name
    		});
    	}

    	get use() {
    		throw new Error("<Span>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<Span>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var Title = classAdderBuilder({
      class: 'mdc-top-app-bar__title',
      component: Span,
      contexts: {}
    });

    function FixedAdjust(node) {
      node.classList.add('mdc-top-app-bar--fixed-adjust');

      return {
        destroy() {
          node.classList.remove('mdc-top-app-bar--fixed-adjust');
        }
      }
    }

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var cssClasses$a = {
        ICON_BUTTON_ON: 'mdc-icon-button--on',
        ROOT: 'mdc-icon-button',
    };
    var strings$9 = {
        ARIA_PRESSED: 'aria-pressed',
        CHANGE_EVENT: 'MDCIconButtonToggle:change',
    };
    //# sourceMappingURL=constants.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var MDCIconButtonToggleFoundation = /** @class */ (function (_super) {
        __extends(MDCIconButtonToggleFoundation, _super);
        function MDCIconButtonToggleFoundation(adapter) {
            return _super.call(this, __assign({}, MDCIconButtonToggleFoundation.defaultAdapter, adapter)) || this;
        }
        Object.defineProperty(MDCIconButtonToggleFoundation, "cssClasses", {
            get: function () {
                return cssClasses$a;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCIconButtonToggleFoundation, "strings", {
            get: function () {
                return strings$9;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCIconButtonToggleFoundation, "defaultAdapter", {
            get: function () {
                return {
                    addClass: function () { return undefined; },
                    hasClass: function () { return false; },
                    notifyChange: function () { return undefined; },
                    removeClass: function () { return undefined; },
                    setAttr: function () { return undefined; },
                };
            },
            enumerable: true,
            configurable: true
        });
        MDCIconButtonToggleFoundation.prototype.init = function () {
            this.adapter_.setAttr(strings$9.ARIA_PRESSED, "" + this.isOn());
        };
        MDCIconButtonToggleFoundation.prototype.handleClick = function () {
            this.toggle();
            this.adapter_.notifyChange({ isOn: this.isOn() });
        };
        MDCIconButtonToggleFoundation.prototype.isOn = function () {
            return this.adapter_.hasClass(cssClasses$a.ICON_BUTTON_ON);
        };
        MDCIconButtonToggleFoundation.prototype.toggle = function (isOn) {
            if (isOn === void 0) { isOn = !this.isOn(); }
            if (isOn) {
                this.adapter_.addClass(cssClasses$a.ICON_BUTTON_ON);
            }
            else {
                this.adapter_.removeClass(cssClasses$a.ICON_BUTTON_ON);
            }
            this.adapter_.setAttr(strings$9.ARIA_PRESSED, "" + isOn);
        };
        return MDCIconButtonToggleFoundation;
    }(MDCFoundation));
    //# sourceMappingURL=foundation.js.map

    /**
     * @license
     * Copyright 2018 Google Inc.
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in
     * all copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     * THE SOFTWARE.
     */
    var strings$a = MDCIconButtonToggleFoundation.strings;
    var MDCIconButtonToggle = /** @class */ (function (_super) {
        __extends(MDCIconButtonToggle, _super);
        function MDCIconButtonToggle() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.ripple_ = _this.createRipple_();
            return _this;
        }
        MDCIconButtonToggle.attachTo = function (root) {
            return new MDCIconButtonToggle(root);
        };
        MDCIconButtonToggle.prototype.initialSyncWithDOM = function () {
            var _this = this;
            this.handleClick_ = function () { return _this.foundation_.handleClick(); };
            this.listen('click', this.handleClick_);
        };
        MDCIconButtonToggle.prototype.destroy = function () {
            this.unlisten('click', this.handleClick_);
            this.ripple_.destroy();
            _super.prototype.destroy.call(this);
        };
        MDCIconButtonToggle.prototype.getDefaultFoundation = function () {
            var _this = this;
            // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
            // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
            var adapter = {
                addClass: function (className) { return _this.root_.classList.add(className); },
                hasClass: function (className) { return _this.root_.classList.contains(className); },
                notifyChange: function (evtData) { return _this.emit(strings$a.CHANGE_EVENT, evtData); },
                removeClass: function (className) { return _this.root_.classList.remove(className); },
                setAttr: function (attrName, attrValue) { return _this.root_.setAttribute(attrName, attrValue); },
            };
            return new MDCIconButtonToggleFoundation(adapter);
        };
        Object.defineProperty(MDCIconButtonToggle.prototype, "ripple", {
            get: function () {
                return this.ripple_;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MDCIconButtonToggle.prototype, "on", {
            get: function () {
                return this.foundation_.isOn();
            },
            set: function (isOn) {
                this.foundation_.toggle(isOn);
            },
            enumerable: true,
            configurable: true
        });
        MDCIconButtonToggle.prototype.createRipple_ = function () {
            var ripple = new MDCRipple(this.root_);
            ripple.unbounded = true;
            return ripple;
        };
        return MDCIconButtonToggle;
    }(MDCComponent));
    //# sourceMappingURL=component.js.map

    /* node_modules/@smui/icon-button/IconButton.svelte generated by Svelte v3.16.0 */
    const file$k = "node_modules/@smui/icon-button/IconButton.svelte";

    // (20:0) {:else}
    function create_else_block$7(ctx) {
    	let button;
    	let forwardEvents_action;
    	let useActions_action;
    	let Ripple_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let button_levels = [
    		/*props*/ ctx[8],
    		{
    			class: "mdc-icon-button " + /*className*/ ctx[2]
    		},
    		{ "aria-hidden": "true" },
    		{ "aria-pressed": /*pressed*/ ctx[0] }
    	];

    	let button_data = {};

    	for (let i = 0; i < button_levels.length; i += 1) {
    		button_data = assign(button_data, button_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			set_attributes(button, button_data);
    			toggle_class(button, "mdc-top-app-bar__navigation-icon", /*context*/ ctx[10] === "top-app-bar:navigation");
    			toggle_class(button, "mdc-icon-button--on", /*pressed*/ ctx[0]);
    			toggle_class(button, "mdc-card__action", /*context*/ ctx[10] === "card:action");
    			toggle_class(button, "mdc-card__action--icon", /*context*/ ctx[10] === "card:action");
    			toggle_class(button, "mdc-top-app-bar__action-item", /*context*/ ctx[10] === "top-app-bar:action");
    			toggle_class(button, "mdc-snackbar__dismiss", /*context*/ ctx[10] === "snackbar");
    			add_location(button, file$k, 20, 2, 715);
    			dispose = listen_dev(button, "MDCIconButtonToggle:change", /*handleChange*/ ctx[11], false, false, false);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			/*button_binding*/ ctx[18](button);
    			forwardEvents_action = /*forwardEvents*/ ctx[9].call(null, button) || ({});
    			useActions_action = useActions.call(null, button, /*use*/ ctx[1]) || ({});

    			Ripple_action = Ripple.call(null, button, [
    				/*ripple*/ ctx[3] && !/*toggle*/ ctx[5],
    				{ unbounded: true, color: /*color*/ ctx[4] }
    			]) || ({});

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 32768) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
    			}

    			set_attributes(button, get_spread_update(button_levels, [
    				dirty & /*props*/ 256 && /*props*/ ctx[8],
    				dirty & /*className*/ 4 && ({
    					class: "mdc-icon-button " + /*className*/ ctx[2]
    				}),
    				{ "aria-hidden": "true" },
    				dirty & /*pressed*/ 1 && ({ "aria-pressed": /*pressed*/ ctx[0] })
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);

    			if (is_function(Ripple_action.update) && dirty & /*ripple, toggle, color*/ 56) Ripple_action.update.call(null, [
    				/*ripple*/ ctx[3] && !/*toggle*/ ctx[5],
    				{ unbounded: true, color: /*color*/ ctx[4] }
    			]);

    			toggle_class(button, "mdc-top-app-bar__navigation-icon", /*context*/ ctx[10] === "top-app-bar:navigation");
    			toggle_class(button, "mdc-icon-button--on", /*pressed*/ ctx[0]);
    			toggle_class(button, "mdc-card__action", /*context*/ ctx[10] === "card:action");
    			toggle_class(button, "mdc-card__action--icon", /*context*/ ctx[10] === "card:action");
    			toggle_class(button, "mdc-top-app-bar__action-item", /*context*/ ctx[10] === "top-app-bar:action");
    			toggle_class(button, "mdc-snackbar__dismiss", /*context*/ ctx[10] === "snackbar");
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			/*button_binding*/ ctx[18](null);
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (Ripple_action && is_function(Ripple_action.destroy)) Ripple_action.destroy();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$7.name,
    		type: "else",
    		source: "(20:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (1:0) {#if href}
    function create_if_block$9(ctx) {
    	let a;
    	let forwardEvents_action;
    	let useActions_action;
    	let Ripple_action;
    	let current;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let a_levels = [
    		/*props*/ ctx[8],
    		{
    			class: "mdc-icon-button " + /*className*/ ctx[2]
    		},
    		{ "aria-hidden": "true" },
    		{ "aria-pressed": /*pressed*/ ctx[0] },
    		{ href: /*href*/ ctx[6] }
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			set_attributes(a, a_data);
    			toggle_class(a, "mdc-top-app-bar__action-item", /*context*/ ctx[10] === "top-app-bar:action");
    			toggle_class(a, "mdc-icon-button--on", /*pressed*/ ctx[0]);
    			toggle_class(a, "mdc-card__action", /*context*/ ctx[10] === "card:action");
    			toggle_class(a, "mdc-card__action--icon", /*context*/ ctx[10] === "card:action");
    			toggle_class(a, "mdc-top-app-bar__navigation-icon", /*context*/ ctx[10] === "top-app-bar:navigation");
    			toggle_class(a, "mdc-snackbar__dismiss", /*context*/ ctx[10] === "snackbar");
    			add_location(a, file$k, 1, 2, 13);
    			dispose = listen_dev(a, "MDCIconButtonToggle:change", /*handleChange*/ ctx[11], false, false, false);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			/*a_binding*/ ctx[17](a);
    			forwardEvents_action = /*forwardEvents*/ ctx[9].call(null, a) || ({});
    			useActions_action = useActions.call(null, a, /*use*/ ctx[1]) || ({});

    			Ripple_action = Ripple.call(null, a, [
    				/*ripple*/ ctx[3] && !/*toggle*/ ctx[5],
    				{ unbounded: true, color: /*color*/ ctx[4] }
    			]) || ({});

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 32768) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
    			}

    			set_attributes(a, get_spread_update(a_levels, [
    				dirty & /*props*/ 256 && /*props*/ ctx[8],
    				dirty & /*className*/ 4 && ({
    					class: "mdc-icon-button " + /*className*/ ctx[2]
    				}),
    				{ "aria-hidden": "true" },
    				dirty & /*pressed*/ 1 && ({ "aria-pressed": /*pressed*/ ctx[0] }),
    				dirty & /*href*/ 64 && ({ href: /*href*/ ctx[6] })
    			]));

    			if (is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);

    			if (is_function(Ripple_action.update) && dirty & /*ripple, toggle, color*/ 56) Ripple_action.update.call(null, [
    				/*ripple*/ ctx[3] && !/*toggle*/ ctx[5],
    				{ unbounded: true, color: /*color*/ ctx[4] }
    			]);

    			toggle_class(a, "mdc-top-app-bar__action-item", /*context*/ ctx[10] === "top-app-bar:action");
    			toggle_class(a, "mdc-icon-button--on", /*pressed*/ ctx[0]);
    			toggle_class(a, "mdc-card__action", /*context*/ ctx[10] === "card:action");
    			toggle_class(a, "mdc-card__action--icon", /*context*/ ctx[10] === "card:action");
    			toggle_class(a, "mdc-top-app-bar__navigation-icon", /*context*/ ctx[10] === "top-app-bar:navigation");
    			toggle_class(a, "mdc-snackbar__dismiss", /*context*/ ctx[10] === "snackbar");
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			/*a_binding*/ ctx[17](null);
    			if (forwardEvents_action && is_function(forwardEvents_action.destroy)) forwardEvents_action.destroy();
    			if (useActions_action && is_function(useActions_action.destroy)) useActions_action.destroy();
    			if (Ripple_action && is_function(Ripple_action.destroy)) Ripple_action.destroy();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(1:0) {#if href}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$o(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$9, create_else_block$7];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*href*/ ctx[6]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$o.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$n($$self, $$props, $$invalidate) {
    	const forwardEvents = forwardEventsBuilder(current_component, ["MDCIconButtonToggle:change"]);
    	let { use = [] } = $$props;
    	let { class: className = "" } = $$props;
    	let { ripple = true } = $$props;
    	let { color = null } = $$props;
    	let { toggle = false } = $$props;
    	let { pressed = false } = $$props;
    	let { href = null } = $$props;
    	let element;
    	let toggleButton;
    	let context = getContext("SMUI:icon-button:context");
    	setContext("SMUI:icon:context", "icon-button");
    	let oldToggle = null;

    	onDestroy(() => {
    		toggleButton && toggleButton.destroy();
    	});

    	function handleChange(e) {
    		$$invalidate(0, pressed = e.detail.isOn);
    	}

    	let { $$slots = {}, $$scope } = $$props;

    	function a_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(7, element = $$value);
    		});
    	}

    	function button_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(7, element = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$invalidate(14, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("use" in $$new_props) $$invalidate(1, use = $$new_props.use);
    		if ("class" in $$new_props) $$invalidate(2, className = $$new_props.class);
    		if ("ripple" in $$new_props) $$invalidate(3, ripple = $$new_props.ripple);
    		if ("color" in $$new_props) $$invalidate(4, color = $$new_props.color);
    		if ("toggle" in $$new_props) $$invalidate(5, toggle = $$new_props.toggle);
    		if ("pressed" in $$new_props) $$invalidate(0, pressed = $$new_props.pressed);
    		if ("href" in $$new_props) $$invalidate(6, href = $$new_props.href);
    		if ("$$scope" in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			use,
    			className,
    			ripple,
    			color,
    			toggle,
    			pressed,
    			href,
    			element,
    			toggleButton,
    			context,
    			oldToggle,
    			props
    		};
    	};

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(14, $$props = assign(assign({}, $$props), $$new_props));
    		if ("use" in $$props) $$invalidate(1, use = $$new_props.use);
    		if ("className" in $$props) $$invalidate(2, className = $$new_props.className);
    		if ("ripple" in $$props) $$invalidate(3, ripple = $$new_props.ripple);
    		if ("color" in $$props) $$invalidate(4, color = $$new_props.color);
    		if ("toggle" in $$props) $$invalidate(5, toggle = $$new_props.toggle);
    		if ("pressed" in $$props) $$invalidate(0, pressed = $$new_props.pressed);
    		if ("href" in $$props) $$invalidate(6, href = $$new_props.href);
    		if ("element" in $$props) $$invalidate(7, element = $$new_props.element);
    		if ("toggleButton" in $$props) $$invalidate(12, toggleButton = $$new_props.toggleButton);
    		if ("context" in $$props) $$invalidate(10, context = $$new_props.context);
    		if ("oldToggle" in $$props) $$invalidate(13, oldToggle = $$new_props.oldToggle);
    		if ("props" in $$props) $$invalidate(8, props = $$new_props.props);
    	};

    	let props;

    	$$self.$$.update = () => {
    		 $$invalidate(8, props = exclude($$props, ["use", "class", "ripple", "color", "toggle", "pressed", "href"]));

    		if ($$self.$$.dirty & /*element, toggle, oldToggle, ripple, toggleButton, pressed*/ 12457) {
    			 if (element && toggle !== oldToggle) {
    				if (toggle) {
    					$$invalidate(12, toggleButton = new MDCIconButtonToggle(element));

    					if (!ripple) {
    						toggleButton.ripple.destroy();
    					}

    					$$invalidate(12, toggleButton.on = pressed, toggleButton);
    				} else if (oldToggle) {
    					toggleButton && toggleButton.destroy();
    					$$invalidate(12, toggleButton = null);
    				}

    				$$invalidate(13, oldToggle = toggle);
    			}
    		}

    		if ($$self.$$.dirty & /*toggleButton, pressed*/ 4097) {
    			 if (toggleButton && toggleButton.on !== pressed) {
    				$$invalidate(12, toggleButton.on = pressed, toggleButton);
    			}
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		pressed,
    		use,
    		className,
    		ripple,
    		color,
    		toggle,
    		href,
    		element,
    		props,
    		forwardEvents,
    		context,
    		handleChange,
    		toggleButton,
    		oldToggle,
    		$$props,
    		$$scope,
    		$$slots,
    		a_binding,
    		button_binding
    	];
    }

    class IconButton extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$n, create_fragment$o, safe_not_equal, {
    			use: 1,
    			class: 2,
    			ripple: 3,
    			color: 4,
    			toggle: 5,
    			pressed: 0,
    			href: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IconButton",
    			options,
    			id: create_fragment$o.name
    		});
    	}

    	get use() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set use(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ripple() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ripple(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get toggle() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set toggle(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pressed() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pressed(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get href() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set href(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.16.0 */
    const file$l = "src/App.svelte";

    // (27:6) <IconButton class="material-icons">
    function create_default_slot_9(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("menu");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_9.name,
    		type: "slot",
    		source: "(27:6) <IconButton class=\\\"material-icons\\\">",
    		ctx
    	});

    	return block;
    }

    // (28:6) <Title>
    function create_default_slot_8(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text(/*title*/ ctx[4]);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_8.name,
    		type: "slot",
    		source: "(28:6) <Title>",
    		ctx
    	});

    	return block;
    }

    // (26:4) <Section on:click={() => navigate("/")}>
    function create_default_slot_7(ctx) {
    	let t;
    	let current;

    	const iconbutton = new IconButton({
    			props: {
    				class: "material-icons",
    				$$slots: { default: [create_default_slot_9] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const title_1 = new Title({
    			props: {
    				$$slots: { default: [create_default_slot_8] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(iconbutton.$$.fragment);
    			t = space();
    			create_component(title_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(iconbutton, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(title_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const iconbutton_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				iconbutton_changes.$$scope = { dirty, ctx };
    			}

    			iconbutton.$set(iconbutton_changes);
    			const title_1_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				title_1_changes.$$scope = { dirty, ctx };
    			}

    			title_1.$set(title_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(iconbutton.$$.fragment, local);
    			transition_in(title_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(iconbutton.$$.fragment, local);
    			transition_out(title_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(iconbutton, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(title_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_7.name,
    		type: "slot",
    		source: "(26:4) <Section on:click={() => navigate(\\\"/\\\")}>",
    		ctx
    	});

    	return block;
    }

    // (31:25) <IconButton class="material-icons" aria-label="Bookmark this page">
    function create_default_slot_6(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("info");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6.name,
    		type: "slot",
    		source: "(31:25) <IconButton class=\\\"material-icons\\\" aria-label=\\\"Bookmark this page\\\">",
    		ctx
    	});

    	return block;
    }

    // (31:8) <Link to="about">
    function create_default_slot_5$1(ctx) {
    	let current;

    	const iconbutton = new IconButton({
    			props: {
    				class: "material-icons",
    				"aria-label": "Bookmark this page",
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(iconbutton.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(iconbutton, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const iconbutton_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				iconbutton_changes.$$scope = { dirty, ctx };
    			}

    			iconbutton.$set(iconbutton_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(iconbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(iconbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(iconbutton, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5$1.name,
    		type: "slot",
    		source: "(31:8) <Link to=\\\"about\\\">",
    		ctx
    	});

    	return block;
    }

    // (30:4) <Section align="end" toolbar>
    function create_default_slot_4$2(ctx) {
    	let current;

    	const link = new Link({
    			props: {
    				to: "about",
    				$$slots: { default: [create_default_slot_5$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(link.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(link, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const link_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				link_changes.$$scope = { dirty, ctx };
    			}

    			link.$set(link_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(link.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(link.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(link, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4$2.name,
    		type: "slot",
    		source: "(30:4) <Section align=\\\"end\\\" toolbar>",
    		ctx
    	});

    	return block;
    }

    // (25:2) <Row>
    function create_default_slot_3$2(ctx) {
    	let t;
    	let current;

    	const section0 = new Section({
    			props: {
    				$$slots: { default: [create_default_slot_7] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	section0.$on("click", /*click_handler*/ ctx[7]);

    	const section1 = new Section({
    			props: {
    				align: "end",
    				toolbar: true,
    				$$slots: { default: [create_default_slot_4$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(section0.$$.fragment);
    			t = space();
    			create_component(section1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(section0, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(section1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const section0_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				section0_changes.$$scope = { dirty, ctx };
    			}

    			section0.$set(section0_changes);
    			const section1_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				section1_changes.$$scope = { dirty, ctx };
    			}

    			section1.$set(section1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(section0.$$.fragment, local);
    			transition_in(section1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(section0.$$.fragment, local);
    			transition_out(section1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(section0, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(section1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3$2.name,
    		type: "slot",
    		source: "(25:2) <Row>",
    		ctx
    	});

    	return block;
    }

    // (24:0) <TopAppBar {dense} {prominent} {variant}>
    function create_default_slot_2$2(ctx) {
    	let current;

    	const row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot_3$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(row.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const row_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(row, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2$2.name,
    		type: "slot",
    		source: "(24:0) <TopAppBar {dense} {prominent} {variant}>",
    		ctx
    	});

    	return block;
    }

    // (37:4) <Route path="/">
    function create_default_slot_1$2(ctx) {
    	let current;
    	const main = new Routes({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(main.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(main, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(main.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(main.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(main, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$2.name,
    		type: "slot",
    		source: "(37:4) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (22:0) <Router url="{url}">
    function create_default_slot$5(ctx) {
    	let t0;
    	let div;
    	let t1;
    	let current;

    	const topappbar = new TopAppBar({
    			props: {
    				dense: /*dense*/ ctx[1],
    				prominent: /*prominent*/ ctx[2],
    				variant: /*variant*/ ctx[3],
    				$$slots: { default: [create_default_slot_2$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const route0 = new Route({
    			props: { path: "about", component: About },
    			$$inline: true
    		});

    	const route1 = new Route({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_1$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(topappbar.$$.fragment);
    			t0 = space();
    			div = element("div");
    			create_component(route0.$$.fragment);
    			t1 = space();
    			create_component(route1.$$.fragment);
    			set_style(div, "padding-top", "80px");
    			add_location(div, file$l, 34, 2, 988);
    		},
    		m: function mount(target, anchor) {
    			mount_component(topappbar, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			mount_component(route0, div, null);
    			append_dev(div, t1);
    			mount_component(route1, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const topappbar_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				topappbar_changes.$$scope = { dirty, ctx };
    			}

    			topappbar.$set(topappbar_changes);
    			const route1_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				route1_changes.$$scope = { dirty, ctx };
    			}

    			route1.$set(route1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(topappbar.$$.fragment, local);
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(topappbar.$$.fragment, local);
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(topappbar, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			destroy_component(route0);
    			destroy_component(route1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$5.name,
    		type: "slot",
    		source: "(22:0) <Router url=\\\"{url}\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$p(ctx) {
    	let current;

    	const router = new Router({
    			props: {
    				url: /*url*/ ctx[0],
    				$$slots: { default: [create_default_slot$5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(router.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};
    			if (dirty & /*url*/ 1) router_changes.url = /*url*/ ctx[0];

    			if (dirty & /*$$scope*/ 256) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$p.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$o($$self, $$props, $$invalidate) {
    	let { url = "" } = $$props;
    	let dense = false;
    	let prominent = false;
    	let variant = "standard";
    	let collapsed = false;
    	let title = "Cards game";
    	let Adjust = FixedAdjust;
    	const writable_props = ["url"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => navigate("/");

    	$$self.$set = $$props => {
    		if ("url" in $$props) $$invalidate(0, url = $$props.url);
    	};

    	$$self.$capture_state = () => {
    		return {
    			url,
    			dense,
    			prominent,
    			variant,
    			collapsed,
    			title,
    			Adjust
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("url" in $$props) $$invalidate(0, url = $$props.url);
    		if ("dense" in $$props) $$invalidate(1, dense = $$props.dense);
    		if ("prominent" in $$props) $$invalidate(2, prominent = $$props.prominent);
    		if ("variant" in $$props) $$invalidate(3, variant = $$props.variant);
    		if ("collapsed" in $$props) collapsed = $$props.collapsed;
    		if ("title" in $$props) $$invalidate(4, title = $$props.title);
    		if ("Adjust" in $$props) Adjust = $$props.Adjust;
    	};

    	return [url, dense, prominent, variant, title, collapsed, Adjust, click_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$o, create_fragment$p, safe_not_equal, { url: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$p.name
    		});
    	}

    	get url() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
