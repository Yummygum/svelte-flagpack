function noop() { }
function is_promise(value) {
    return value && typeof value === 'object' && typeof value.then === 'function';
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
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function null_to_empty(value) {
    return value == null ? '' : value;
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
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
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
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
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

function handle_promise(promise, info) {
    const token = info.token = {};
    function update(type, index, key, value) {
        if (info.token !== token)
            return;
        info.resolved = value;
        let child_ctx = info.ctx;
        if (key !== undefined) {
            child_ctx = child_ctx.slice();
            child_ctx[key] = value;
        }
        const block = type && (info.current = type)(child_ctx);
        let needs_flush = false;
        if (info.block) {
            if (info.blocks) {
                info.blocks.forEach((block, i) => {
                    if (i !== index && block) {
                        group_outros();
                        transition_out(block, 1, 1, () => {
                            if (info.blocks[i] === block) {
                                info.blocks[i] = null;
                            }
                        });
                        check_outros();
                    }
                });
            }
            else {
                info.block.d(1);
            }
            block.c();
            transition_in(block, 1);
            block.m(info.mount(), info.anchor);
            needs_flush = true;
        }
        info.block = block;
        if (info.blocks)
            info.blocks[index] = block;
        if (needs_flush) {
            flush();
        }
    }
    if (is_promise(promise)) {
        const current_component = get_current_component();
        promise.then(value => {
            set_current_component(current_component);
            update(info.then, 1, info.value, value);
            set_current_component(null);
        }, error => {
            set_current_component(current_component);
            update(info.catch, 2, info.error, error);
            set_current_component(null);
            if (!info.hasCatch) {
                throw error;
            }
        });
        // if we previously had a then/catch block, destroy it
        if (info.current !== info.pending) {
            update(info.pending, 0);
            return true;
        }
    }
    else {
        if (info.current !== info.then) {
            update(info.then, 1, info.value, promise);
            return true;
        }
        info.resolved = promise;
    }
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
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
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
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
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
/**
 * Base class for Svelte components. Used when dev=false.
 */
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
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* src\Flag.svelte generated by Svelte v3.32.1 */

function add_css() {
	var style = element("style");
	style.id = "svelte-1jgc1e0-style";
	style.textContent = ".flag.svelte-1jgc1e0.svelte-1jgc1e0{display:inline-block;overflow:hidden;position:relative;box-sizing:border-box;align-items:center}.flag.svelte-1jgc1e0 .svelte-1jgc1e0{display:flex;width:100%;height:100%;object-fit:cover}.flag.size-s.svelte-1jgc1e0.svelte-1jgc1e0{width:16px;height:12px}.flag.size-s.drop-shadow.svelte-1jgc1e0.svelte-1jgc1e0{box-shadow:0 0 1px 0.5px rgba(0, 0, 0, 0.1)}.flag.size-s.border-radius.svelte-1jgc1e0.svelte-1jgc1e0{border-radius:1px}.flag.size-s.border-radius.border.svelte-1jgc1e0.svelte-1jgc1e0::before{border-radius:1px}.flag.size-m.svelte-1jgc1e0.svelte-1jgc1e0{width:20px;height:15px}.flag.size-m.drop-shadow.svelte-1jgc1e0.svelte-1jgc1e0{box-shadow:0 1px 2px 0 rgba(0, 0, 0, 0.1)}.flag.size-m.border-radius.svelte-1jgc1e0.svelte-1jgc1e0{border-radius:1.5px}.flag.size-m.border-radius.border.svelte-1jgc1e0.svelte-1jgc1e0::before{border-radius:1.5px}.flag.size-l.svelte-1jgc1e0.svelte-1jgc1e0{width:32px;height:24px}.flag.size-l.drop-shadow.svelte-1jgc1e0.svelte-1jgc1e0{box-shadow:0 2px 3px 0 rgba(0, 0, 0, 0.1)}.flag.size-l.border-radius.svelte-1jgc1e0.svelte-1jgc1e0{border-radius:2px}.flag.size-l.border-radius.border.svelte-1jgc1e0.svelte-1jgc1e0::before{border-radius:2px}.flag.border.svelte-1jgc1e0.svelte-1jgc1e0::before{content:'';width:100%;height:100%;position:absolute;display:block;mix-blend-mode:overlay;box-sizing:border-box;border:1px solid rgba(0, 0, 0, 0.5);mix-blend-mode:overlay}.flag.top-down.svelte-1jgc1e0.svelte-1jgc1e0::before{content:'';width:100%;height:100%;position:absolute;display:block;mix-blend-mode:overlay;box-sizing:border-box;background-image:linear-gradient(0deg, rgba(0, 0, 0, 0.3) 2%, rgba(255, 255, 255, 0.7) 100%)}.flag.real-linear.svelte-1jgc1e0.svelte-1jgc1e0::before{content:'';width:100%;height:100%;position:absolute;display:block;mix-blend-mode:overlay;box-sizing:border-box;background-image:linear-gradient(45deg, rgba(0, 0, 0, 0.2) 0%, rgba(39, 39, 39, 0.22) 11%, rgba(255, 255, 255, 0.3) 27%, rgba(0, 0, 0, 0.24) 41%, rgba(0, 0, 0, 0.55) 52%, rgba(255, 255, 255, 0.26) 63%, rgba(0, 0, 0, 0.27) 74%, rgba(255, 255, 255, 0.3) 100%)}.flag.real-circular.svelte-1jgc1e0.svelte-1jgc1e0::before{content:'';width:100%;height:100%;position:absolute;display:block;mix-blend-mode:overlay;box-sizing:border-box;background:radial-gradient(50% 36%, rgba(255, 255, 255, 0.3) 0%, rgba(0, 0, 0, 0.24) 11%, rgba(0, 0, 0, 0.55) 17%, rgba(255, 255, 255, 0.26) 22%, rgba(0, 0, 0, 0.17) 27%, rgba(255, 255, 255, 0.28) 31%, rgba(255, 255, 255, 0) 37%) center calc(50% - 8px)/600% 600%, radial-gradient(50% 123%, rgba(255, 255, 255, 0.3) 25%, rgba(0, 0, 0, 0.24) 48%, rgba(0, 0, 0, 0.55) 61%, rgba(255, 255, 255, 0.26) 72%, rgba(0, 0, 0, 0.17) 80%, rgba(255, 255, 255, 0.28) 88%, rgba(255, 255, 255, 0.3) 100%) center calc(50% - 8px)/600% 600%}";
	append(document.head, style);
}

// (1:0) <script>   import { onMount }
function create_catch_block(ctx) {
	return { c: noop, m: noop, p: noop, d: noop };
}

// (34:43)      <img src="{Flag}
function create_then_block(ctx) {
	let img;
	let img_src_value;
	let img_alt_value;
	let t0;
	let t1_value = console.log(/*Flag*/ ctx[8]) + "";
	let t1;

	return {
		c() {
			img = element("img");
			t0 = space();
			t1 = text(t1_value);
			if (img.src !== (img_src_value = /*Flag*/ ctx[8])) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = `Flag of ${/*code*/ ctx[2]}`);
			attr(img, "class", "svelte-1jgc1e0");
		},
		m(target, anchor) {
			insert(target, img, anchor);
			insert(target, t0, anchor);
			insert(target, t1, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*size, code*/ 5 && img.src !== (img_src_value = /*Flag*/ ctx[8])) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*code*/ 4 && img_alt_value !== (img_alt_value = `Flag of ${/*code*/ ctx[2]}`)) {
				attr(img, "alt", img_alt_value);
			}

			if (dirty & /*size, code*/ 5 && t1_value !== (t1_value = console.log(/*Flag*/ ctx[8]) + "")) set_data(t1, t1_value);
		},
		d(detaching) {
			if (detaching) detach(img);
			if (detaching) detach(t0);
			if (detaching) detach(t1);
		}
	};
}

// (1:0) <script>   import { onMount }
function create_pending_block(ctx) {
	return { c: noop, m: noop, p: noop, d: noop };
}

function create_fragment(ctx) {
	let div;
	let promise;
	let div_class_value;

	let info = {
		ctx,
		current: null,
		token: null,
		hasCatch: false,
		pending: create_pending_block,
		then: create_then_block,
		catch: create_catch_block,
		value: 8
	};

	handle_promise(promise = /*importFlag*/ ctx[7](/*size*/ ctx[0], /*code*/ ctx[2]), info);

	return {
		c() {
			div = element("div");
			info.block.c();

			attr(div, "class", div_class_value = "" + (null_to_empty(`
  flag
  ${/*gradient*/ ctx[1]}
  size-${/*size*/ ctx[0]}
  ${/*hasBorder*/ ctx[3] ? "border" : ""}
  ${/*hasDropShadow*/ ctx[4] ? "drop-shadow" : ""}
  ${/*hasBorderRadius*/ ctx[5] ? "border-radius" : ""}
  ${/*className*/ ctx[6]
			? /*className*/ ctx[6].replace(/\s\s+/g, " ").trim()
			: ""}
`) + " svelte-1jgc1e0"));
		},
		m(target, anchor) {
			insert(target, div, anchor);
			info.block.m(div, info.anchor = null);
			info.mount = () => div;
			info.anchor = null;
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;
			info.ctx = ctx;

			if (dirty & /*size, code*/ 5 && promise !== (promise = /*importFlag*/ ctx[7](/*size*/ ctx[0], /*code*/ ctx[2])) && handle_promise(promise, info)) ; else {
				const child_ctx = ctx.slice();
				child_ctx[8] = info.resolved;
				info.block.p(child_ctx, dirty);
			}

			if (dirty & /*gradient, size, hasBorder, hasDropShadow, hasBorderRadius, className*/ 123 && div_class_value !== (div_class_value = "" + (null_to_empty(`
  flag
  ${/*gradient*/ ctx[1]}
  size-${/*size*/ ctx[0]}
  ${/*hasBorder*/ ctx[3] ? "border" : ""}
  ${/*hasDropShadow*/ ctx[4] ? "drop-shadow" : ""}
  ${/*hasBorderRadius*/ ctx[5] ? "border-radius" : ""}
  ${/*className*/ ctx[6]
			? /*className*/ ctx[6].replace(/\s\s+/g, " ").trim()
			: ""}
`) + " svelte-1jgc1e0"))) {
				attr(div, "class", div_class_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			info.block.d();
			info.token = null;
			info = null;
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { code = "NL" } = $$props;
	let { size = "m" } = $$props;
	let { gradient = "" } = $$props;
	let { hasBorder = true } = $$props;
	let { hasDropShadow = false } = $$props;
	let { hasBorderRadius = true } = $$props;
	let { className } = $$props;
	const lower = q => q.toLowerCase();
	let Flag;

	async function importFlag(size, code) {
		return Promise.resolve().then(function () { return NL$1; }).then(res => res.default);
	}

	$$self.$$set = $$props => {
		if ("code" in $$props) $$invalidate(2, code = $$props.code);
		if ("size" in $$props) $$invalidate(0, size = $$props.size);
		if ("gradient" in $$props) $$invalidate(1, gradient = $$props.gradient);
		if ("hasBorder" in $$props) $$invalidate(3, hasBorder = $$props.hasBorder);
		if ("hasDropShadow" in $$props) $$invalidate(4, hasDropShadow = $$props.hasDropShadow);
		if ("hasBorderRadius" in $$props) $$invalidate(5, hasBorderRadius = $$props.hasBorderRadius);
		if ("className" in $$props) $$invalidate(6, className = $$props.className);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*gradient*/ 2) {
			 $$invalidate(1, gradient = lower(gradient));
		}

		if ($$self.$$.dirty & /*size*/ 1) {
			 $$invalidate(0, size = lower(size));
		}
	};

	return [
		size,
		gradient,
		code,
		hasBorder,
		hasDropShadow,
		hasBorderRadius,
		className,
		importFlag,
		Flag
	];
}

class Flag_1 extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1jgc1e0-style")) add_css();

		init(this, options, instance, create_fragment, safe_not_equal, {
			code: 2,
			size: 0,
			gradient: 1,
			hasBorder: 3,
			hasDropShadow: 4,
			hasBorderRadius: 5,
			className: 6
		});
	}
}

var NL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAzMiAyNCI+PG1hc2sgaWQ9Ik5MX3N2Z19fYSIgd2lkdGg9IjMyIiBoZWlnaHQ9IjI0IiB4PSIwIiB5PSIwIiBtYXNrVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMCAwaDMydjI0SDB6Ii8+PC9tYXNrPjxnIG1hc2s9InVybCgjTkxfc3ZnX19hKSI+PHBhdGggZmlsbD0iI0Y3RkNGRiIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMCAwdjI0aDMyVjBIMHoiIGNsaXAtcnVsZT0iZXZlbm9kZCIvPjxtYXNrIGlkPSJOTF9zdmdfX2IiIHdpZHRoPSIzMiIgaGVpZ2h0PSIyNCIgeD0iMCIgeT0iMCIgbWFza1VuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMCAwdjI0aDMyVjBIMHoiIGNsaXAtcnVsZT0iZXZlbm9kZCIvPjwvbWFzaz48ZyBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgbWFzaz0idXJsKCNOTF9zdmdfX2IpIj48cGF0aCBmaWxsPSIjRTMxRDFDIiBkPSJNMCAwdjhoMzJWMEgweiIvPjxwYXRoIGZpbGw9IiMzRDU4REIiIGQ9Ik0wIDE2djhoMzJ2LThIMHoiLz48L2c+PC9nPjwvc3ZnPg==';

var NL$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': NL
});

export default Flag_1;
