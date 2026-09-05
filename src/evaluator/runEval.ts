import { WorldBuilder, EntityFactory, PhysicsConfig, AcousticPropagation } from '../sdk/index.js';
import { Message } from '../communication/Message.js';
import { WorldEvaluator } from './WorldEvaluator.js';
import { Logger } from '../reliability/Logger.js';
const log = Logger.for('eval-main');
function main(): void {
  const world = new WorldBuilder('eval-world').setConfig({ tickRate: 60 }).usePhysics(PhysicsConfig.builder().gravity(9.8).restitution(0.6).build())
    .addEntity(EntityFactory.staticBox('ground', { x: 0, y: -0.5, z: 0 }, { x: 20, y: 0.5, z: 20 }))
    .addEntity(EntityFactory.dynamicBox({ name: 'box-a', position: { x: -2, y: 5, z: 0 }, mass: 1, material: 'wood' }))
    .addEntity(EntityFactory.dynamicBox({ name: 'box-b', position: { x: 2, y: 7, z: 0 }, mass: 3, material: 'metal' }))
    .addEntity(EntityFactory.soulProxy({ soulId: 'eval_vex', name: 'Vex', element: 'wind', position: { x: -1, y: 1, z: 0 } }))
    .build();
  const evaluator = new WorldEvaluator();
  world.events.on('physics.collision', () => evaluator.bump('collisions'));
  world.events.on('world.tick', () => evaluator.bump('events'));
  const TICKS = 120; const dt = 1 / 60;
  for (let i = 0; i < TICKS; i++) { const t0 = performance.now(); world.step(dt); evaluator.recordTick(performance.now() - t0); }
  const acoustic = new AcousticPropagation({ maxRadius: 30 });
  const vex = world.getEntity('soul_eval_vex')!;
  const nova = EntityFactory.soulProxy({ soulId: 'eval_nova', name: 'Nova', element: 'fire', position: { x: 5, y: 1, z: 0 } });
  world.addEntity(nova);
  const received = acoustic.transmit(new Message({ content: 'hello from Vex', sourceId: vex.id, position: vex.position.toObject(), medium: 'acoustic', intensity: 1 }), vex as never, { entities: world.bodies() as never, byId: (id: string) => world.getEntity(id) as never });
  evaluator.bump('messages', received.length);
  evaluator.flush(world);
  log.info({ received: received.length }, 'eval complete');
}
main();
