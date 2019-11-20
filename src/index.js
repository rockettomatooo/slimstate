import cloneDeep from 'lodash/cloneDeep';
import clone from 'lodash/clone';
import { EventEmitter } from 'events';

export function typeOf(obj) {
    const longType = Object.prototype.toString.call(obj);
    return longType.substr(8, longType.length - 9);
}

class SpecError extends Error {
    name = 'SpecError';

    constructor(instance, message) {
        super(`[${instance.getId()}] ${message}`)
    }
}
class ValidationError extends SpecError {
    name = 'ValidationError';
}

class ParseError extends Error {
    name = 'ParseError';
    constructor(errors, message) {
        super(message);
        this.errors = errors;
    }
}

class StateSpec {
    constructor(name, state) {
        this.name = name;
        this.errors = [];

        // prevent endless recursion on clone
        this.machine = null;
        Object.defineProperty(this, 'machine', { enumerable: false });

        this.events = {};
        state.on = state.on || {};
        if (state.on instanceof Object) {
            for (const [eventName, target] of Object.entries(state.on)) {
                if (typeOf(target) === 'String') {
                    this.events[eventName] = target;
                }
                else {
                    this.errors.push(new SpecError(this, `the target of event "${eventName}" must be type of string (got: ${typeOf(target)})`));
                }
            }
        }
        else {
            this.errors.push(new SpecError(this, `events (${this.name}.on) must be defined as an object (got: ${typeOf(state.on)})`));
        }
    }

    getId() {
        return `${this.machine.getId()}.${this.name}`;
    }

    hasEvent(eventName) {
        return eventName in this.events;
    }
    getTarget(eventName) {
        return this.events[eventName];
    }

    validate() {
        const errors = [].concat(this.errors);
        for (const [eventName, target] of Object.entries(this.events)) {
            if (!this.machine.hasState(target)) {
                errors.push(new ValidationError(this, `target "${target}" of event "${eventName}" does not exist in statemachine "${this.machine.getId()}"`));
            }
        }
        return errors;
    }
}

class StateMachineSpec {
    constructor(sm) {
        this.errors = [];
        this.states = {};

        if (!(sm instanceof Object)) {
            this.errors.push(new SpecError(this, `a state machine must be an object (got: ${typeOf(sm)})`));
            return;
        }

        if (typeOf(sm.id) === 'String') {
            this.id = sm.id;
        }
        else this.errors.push(new SpecError(this, `the id must be type of string (got: ${typeOf(sm.id)})`));

        if (typeOf(sm.initial) === 'String') {
            this.initial = sm.initial;
        }
        else this.errors.push(new SpecError(this, `the initial state must be type of string (got: ${typeOf(sm.initial)})`));

        if (sm.states instanceof Object) {
            for (const [stateName, state] of Object.entries(sm.states)) {
                if (!(state instanceof Object)) {
                    this.errors.push(new SpecError(this, `state "${stateName}" must be defined as an object (got: ${typeOf(state)})`));
                    continue;
                }
                const newState = new StateSpec(stateName, state);
                newState.machine = this;
                this.states[stateName] = newState;
            }
        }
        else this.errors.push(new SpecError(this, `states must be defined as an object (got: ${typeOf(sm.states)})`));
    }

    getId() {
        return this.id;
    }

    hasState(stateName) {
        return stateName in this.states;
    }
    getState(stateName) {
        return this.states[stateName];
    }

    validate() {
        let errors = [].concat(this.errors);


        for (const state of Object.values(this.states)) {
            errors.push(...state.validate());
        }

        if (!this.hasState(this.initial)) {
            errors.push(new ValidationError(this, `initial state does not exist`));
        }

        return errors;
    }
}

export function parse(sm) {
    const spec = new StateMachineSpec(sm);
    const errors = spec.validate();

    if (errors.length) throw new ParseError(errors, `state machine is invalid`);

    return spec;
}

class Event {
    constructor(type, data = {}) {
        for (const [key, value] of Object.entries(data)) {
            this[key] = value;
        }

        this.type = type;
        this._proceed = true;
    }

    stop() {
        this._proceed = false;
    }

    isStopped() {
        return !this._proceed;
    }
}

class StateMachine {
    constructor(spec) {
        this._spec = spec;
        this._emitter = new EventEmitter();

        this.state = this._spec.initial;
        this._stateSpec = this._spec.getState(this.state);
    }

    send(event) {
        if (!this._stateSpec.hasEvent(event)) {
            this._emitter.emit('event', new Event('event', { event }));
            return this.state;
        }

        const oldState = this.state;
        const newState = this._stateSpec.getTarget(event);
        const eventInstance = new Event('transition', { from: oldState, to: newState });
        this._emitter.emit('event', eventInstance);

        if (!eventInstance.isStopped()) {
            this.state = newState;
            this._stateSpec = this._spec.getState(this.state);
            this._emitter.emit('transition', oldState, this.state);
        }
        return this.state;
    }

    on(event, fn) {
        this._emitter.on(event, fn);
    }
    once(event, fn) {
        this._emitter.once(event, fn);
    }
    removeListener(event, fn) {
        this._emitter.removeListener(event, fn);
    }
}

export function launch(spec) {
    if (!(spec instanceof StateMachineSpec)) {
        throw new Error(`spec must be a parsed state machine`);
    }

    return new StateMachine(spec);
}