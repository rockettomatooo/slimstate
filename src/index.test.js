import { expect } from 'chai';
import { typeOf, parse, launch } from './index';

describe('the utility', function () {
  describe('typeof()', function () {
    it('gives the correct string', function () {
      expect(typeOf('')).to.equal('String');
    })
  })
})

describe('a state machine', function () {
  it('must contain an id', function () {
    expect(parse.bind(null, {
      id: 'test',
      initial: 'deactivated',
      states: {
        deactivated: {}
      }
    })).to.not.throw;

    const faultyMachine = {
      initial: 'deactivated',
      states: {
        deactivated: {}
      }
    };

    expect(parse.bind(null, faultyMachine)).to.throw;
    try {
      parse(faultyMachine)
    } catch (e) {
      expect(e.errors[0].message).to.equal('[undefined] the id must be type of string (got: Undefined)');
    }
  });

  it('must contain an initial state', function () {
    expect(parse.bind(null, {
      id: 'test',
      initial: 'deactivated',
      states: {
        deactivated: {}
      }
    })).to.not.throw;

    const faultyMachine = {
      id: 'test',
      states: {
        deactivated: {}
      }
    }
    expect(parse.bind(null, faultyMachine)).to.throw;

    try {
      parse(faultyMachine);
    }
    catch (e) {
      expect(e.errors[0].message).to.equal('[test] the initial state must be type of string (got: Undefined)')
      expect(e.errors[1].message).to.equal('[test] initial state does not exist')
    }
  });

  it('validates all event targets', function () {
    expect(parse.bind(null, {
      id: 'test',
      initial: 'deactivated',
      states: {
        deactivated: {
          on: {
            TOGGLE: 'activated'
          }
        },
        activated: {
          on: {
            TOGGLE: 'deactivated'
          }
        }
      }
    })).to.not.throw;

    const faultyMachine = {
      id: 'test',
      initial: 'deactivated',
      states: {
        deactivated: {
          on: {
            TOGGLE: 'nostate'
          }
        },
        activated: {
          on: {
            TOGGLE: 'deactivated'
          }
        }
      }
    };
    expect(parse.bind(null, faultyMachine)).to.throw;

    try {
      parse(faultyMachine);
    }
    catch (e) {
      expect(e.errors[0].message).to.equal('[test.deactivated] target "nostate" of event "TOGGLE" does not exist in statemachine "test"')
    }
  })
});

describe('a state machine instance', function () {
  const machine = parse({
    id: 'toggleMachine',
    initial: 'deactivated',
    states: {
      activated: {
        on: {
          TOGGLE: 'deactivated'
        }
      },
      deactivated: {
        on: {
          TOGGLE: 'activated'
        }
      }
    }
  });

  it('initializes with a spec', function () {
    expect(launch.bind(null, machine)).to.not.throw;
    expect(launch.bind(null, {})).to.throw(Error);
  });

  it('emits events', function (done) {
    const instance = launch(machine);
    let didFire = false;
    instance.on('event', e => {
      didFire = true;
      done();
    });
    setTimeout(() => !didFire ? done('event did not fire') : null, 1000);
    instance.send('test');
  });

  it('can transition', function () {
    const instance = launch(machine);
    expect(instance.state).to.equal('deactivated');

    instance.send('TOGGLE');
    expect(instance.state).to.equal('activated');
  });

  it('can stop a transition within an event', function () {
    const instance = launch(machine);
    instance.on('event', e => {
      if (e.type === 'transition') e.stop();
    });
    instance.send('TOGGLE');
    expect(instance.state).to.equal('deactivated');
  });
})