import { Intention } from "./intention.js";
import { me, client, deliverySpots, distance, mapGraph, carriedParcels } from "./intention_revision.js";

import dijkstra from 'graphology-shortest-path';

class Plan {

    // This is used to stop the plan
    #stopped = false;
    stop () {
        this.log( 'stop plan' );
        this.#stopped = true;
        for ( const i of this.#sub_intentions ) {
            i.stop();
        }
    }
    get stopped () {
        return this.#stopped;
    }

    /**
     * #parent refers to caller
     */
    #parent;

    constructor ( parent ) {
        this.#parent = parent;
    }

    log ( ...args ) {
        if ( this.#parent && this.#parent.log )
            this.#parent.log( '\t', ...args )
        else
            console.log( ...args )
    }

    // this is an array of sub intention. Multiple ones could eventually being achieved in parallel.
    #sub_intentions = [];

    async subIntention ( predicate ) {
        const sub_intention = new Intention( this, predicate );
        this.#sub_intentions.push( sub_intention );
        return await sub_intention.achieve();
    }

}

export class GoPickUp extends Plan {

    static isApplicableTo ( go_pick_up, x, y, id ) {
        return go_pick_up == 'go_pick_up';
    }

    async execute ( go_pick_up, x, y ) {
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        await this.subIntention( ['go_to', x, y] );
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        await client.pickup();
        //console.log('Adesso vado a consegnare...')
        // carriedParcels.push(id);
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        await this.subIntention( ['go_deliver'])
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        return true;
    }
    
}

export class GoDeliver extends Plan {21
    static isApplicableTo ( go_deliver ) {
        return go_deliver == 'go_deliver';
    }
    
    async execute() {
        let nearest = Number.MAX_VALUE;
        let best_spot = [];
        for (const deliverySpot of deliverySpots) {
            let current_d = distance( {x:parseInt(deliverySpot[0]), y:parseInt(deliverySpot[1])}, me )
            if ( current_d < nearest ) {
                best_spot = deliverySpot;
                nearest = current_d
            }
        }
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        await this.subIntention( ['go_to', parseInt(best_spot[0]), parseInt(best_spot[1])] );
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        console.log("CARRYING: ", carriedParcels);
        await client.putdown();
        carriedParcels.length = 0;
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        return true;
    }
}
export let path = [];
export class BlindMove extends Plan {

    static isApplicableTo ( go_to, x, y ) {
        return go_to == 'go_to';
    }

    async execute ( go_to, x, y ) {
        // console.log("I'm moving...");

        if ( this.stopped ) throw ['stopped']; // if stopped then quit

        let myPos = Math.round(me.x) + "-" +  Math.round(me.y);
        let dest = Math.round(x) + "-" + Math.round(y);
        // console.log("I'm moving 2...");

        path = dijkstra.bidirectional(mapGraph, myPos, dest);
        path.shift();                          // the algorithm returns an array with the current position at [0], we need to remove it
        let nextCoordinates; 
        // console.log("PATH: ", path);
        if ( this.stopped ) throw ['stopped']; // if stopped then quit

        for(let nextDest of path){
            // console.log('MUOVO: ', nextDest);
            nextCoordinates = nextDest.split("-");
            
            // TODO deliver if on a delivery spot

            if( nextCoordinates[0] > me.x){
                await client.move('right');
            }else if(nextCoordinates[0] < me.x){
                await client.move('left');
            }else if( nextCoordinates[1] > me.y){
                await client.move('up');
            }else if(nextCoordinates[1] < me.y){
                await client.move('down');
            }

            if ( this.stopped ) throw ['stopped']; // if stopped then quit
        }

        return true;

    }
}
