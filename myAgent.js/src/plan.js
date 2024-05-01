import { Intention } from "./intention";

export class Plan {

    stop () {
        console.log( 'stop plan and all sub intentions');
        for ( const i of this.#sub_intentions ) {
            i.stop();
        }
    }

    #sub_intentions = [];

    async subIntention ( desire, ...args ) {
        const sub_intention = new Intention( desire, ...args );
        this.#sub_intentions.push(sub_intention);
        return await sub_intention.achieve();
    }

}

class GoPickUp extends Plan {

    isApplicableTo ( desire ) {
        return desire == 'go_pick_up';
    }

    async execute ( {x, y} ) {
        // TODO move to x,y
        await this.subIntention( 'go_to', {x,y});
        await client.pickup();
    }

}

class BlindMove extends Plan {

    isApplicableTo ( desire ) {
        return desire == 'go_to';
    }

    async execute ( {x, y} ) {
        while(me.x != x || me.y != y){
            const dx = x - me.x;
            const dy = y - me.y;
            // TODO move rigth left up down
        }
    }
}