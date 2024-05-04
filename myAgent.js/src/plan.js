import { Intention } from "./intention.js";
import { me, client, deliverySpots, distance, mapGraph } from "./intention_revision.js";

import UndirectedGraph from 'graphology';
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
        await client.pickup()
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        await this.subIntention( ['go_deliver'] );
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        return true;
    }
    
}

export class GoDeliver extends Plan {
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
        await client.putdown()
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        return true;
    }
}

export class BlindMove extends Plan {

    static isApplicableTo ( go_to, x, y ) {
        return go_to == 'go_to';
    }

    async execute ( go_to, x, y ) {

        if ( this.stopped ) throw ['stopped']; // if stopped then quit

        let myPos = Math.round(me.x) + "-" +  Math.round(me.y);
        let dest = Math.round(x) + "-" + Math.round(y);

        let path = dijkstra.bidirectional(mapGraph, myPos, dest);
        console.log("PATH: ", path);
        path.shift();           //the algorithm returns an array with the current position at [0], we need to remove it
        let nextCoordinates; 

        if ( this.stopped ) throw ['stopped']; // if stopped then quit

        for(let nextDest of path){
            nextCoordinates = nextDest.split("-");
            
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

        // while ( me.x != x || me.y != y ) {
        //     if ( this.stopped ) throw ['stopped']; // if stopped then quit
            
        //     let status_x = false;
        //     let status_y = false;
            
        //     console.log('me', me, 'xy', x, y);
            
        //     if ( x > me.x ){
        //         status_x = await client.move('right')
        //         // status_x = await this.subIntention( 'go_to', {x: me.x+1, y: me.y} );
        //     }else if ( x < me.x ){
        //         status_x = await client.move('left')
        //         // status_x = await this.subIntention( 'go_to', {x: me.x-1, y: me.y} );
        //     }
        //     if (status_x) {
        //         me.x = status_x.x;
        //         me.y = status_x.y;
        //     }

        //     if ( this.stopped ) throw ['stopped']; // if stopped then quit

        //     if ( y > me.y ){
        //         status_y = await client.move('up')
        //         // status_x = await this.subIntention( 'go_to', {x: me.x, y: me.y+1} );
        //     }
        //     else if ( y < me.y ){
        //         status_y = await client.move('down')
        //         // status_x = await this.subIntention( 'go_to', {x: me.x, y: me.y-1} );
        //     }

        //     if (status_y) {
        //         me.x = status_y.x;
        //         me.y = status_y.y;
        //     }
            
        //     if ( ! status_x && ! status_y) {
        //         this.log('stucked');
        //         throw 'stucked';
        //     } else if ( me.x == x && me.y == y ) {
        //         // this.log('target reached');
        //     }
            
        // }

        return true;

    }
}
