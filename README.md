# `slimstate`

```js
import { parse, launch } from 'statemachine';


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

const instance = launch(machine);
instance.state // deactivated

instance.send('TOGGLE');
instance.state // activated

instance.send('TOGGLE');
instance.state // deactivated

```