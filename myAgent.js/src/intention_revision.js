import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";

import {default as config} from '../config.js';
// import { GoPickUp, BlindMove } from './plan.js';
import { Intention } from "./intention.js";

import UndirectedGraph from 'graphology';
import dijkstra from 'graphology-shortest-path';

export const client = new DeliverooApi(
    // 'http://localhost:8080',
    // 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA5ZmQ2NDllNzZlIiwibmFtZSI6Im1hcmNvIiwiaWF0IjoxNjc5OTk3Njg2fQ.6_zmgL_C_9QgoOX923ESvrv2i2_1bgL_cWjMw4M7ah4'
    config.host,
    config.token
)

export function distance( {x:x1, y:y1}, {x:x2, y:y2}) {
    // const dx = Math.abs( Math.round(x1) - Math.round(x2) )
    // const dy = Math.abs( Math.round(y1) - Math.round(y2) )
    // return dx + dy;
    
    let path = dijkstra.bidirectional(mapGraph, Math.round(x1) + "-" + Math.round(y1), Math.round(x2) + "-" + Math.round(y2))
    
    if(!path){
        if(mapGraph.hasNode(Math.round(x1) + "-" + Math.round(y1)) && mapGraph.hasNode(Math.round(x2) + "-" + Math.round(y2))){
            console.log("POSIZIONI SBAGLIATE:", Math.round(x1) + "-" + Math.round(y1), Math.round(x2) + "-" + Math.round(y2));
        }
        return Number.MAX_VALUE;
    }
    
    return path.length - 1;
}

/**
 * Beliefset revision function
 */
export const me = {};
client.onYou( ( {id, name, x, y, score} ) => {
    me.id = id
    me.name = name
    me.x = x
    me.y = y
    me.score = score
} )
const parcels = new Map();
client.onParcelsSensing( async ( perceived_parcels ) => {
    for (const p of perceived_parcels) {
        parcels.set( p.id, p)
    }
} )
client.onConfig( (param) => {
    // console.log(param);
} )

/** 
 * @type [x, y, delivery, parcelSpawner] 
 */
    
let mapWidth;
let mapHeight;
export let deliverySpots = [];
export const mapGraph = new UndirectedGraph();

client.onMap( ( width, height, data ) => {
    mapWidth = width;
    mapHeight = height;
    let nodeId = new String;
    for(let tile of data){
        nodeId = tile.x + "-" + tile.y;
        mapGraph.addNode(nodeId, { x:tile.x, y:tile.y, delivery:tile.delivery });
        
        mapGraph.forEachNode((node, attributes) => {
            if(node != nodeId){
                if((attributes.x == tile.x && (attributes.y == tile.y+1 || attributes.y == tile.y-1)) || (attributes.y == tile.y && (attributes.x == tile.x+1 || attributes.x == tile.x-1))){
                    mapGraph.addUndirectedEdge(nodeId,node);
                }
            }
        });
    }

    let buffer = mapGraph.filterNodes((node, attributes) => {
        return attributes.delivery;
    })
    for(let spot of buffer){
        deliverySpots.push(spot.split("-"));
    }

    // console.log(mapGraph);
})


/**
 * Options generation and filtering function
 */
client.onParcelsSensing( parcels => {

    // TODO revisit beliefset revision so to trigger option generation only in the case a new parcel is observed

    /**
     * Options generation
     */

    const options = []
    for (const parcel of parcels.values())
        if ( ! parcel.carriedBy )
            options.push( [ 'go_pick_up', parcel.x, parcel.y, parcel.id ] );
            // myAgent.push( [ 'go_pick_up', parcel.x, parcel.y, parcel.id ] )
    /**
     * Options filtering
     */
    let best_option;
    let nearest = Number.MAX_VALUE;
    for (const option of options) {
        if ( option[0] == 'go_pick_up' ) {
            let [go_pick_up,x,y,id] = option;
            let current_d = distance( {x, y}, me )
            if ( current_d < nearest ) {
                best_option = option
                nearest = current_d
            }
        }
    }

    /**
     * Best option is selected
     */
    if ( best_option ){
        myAgent.push( best_option )
        // myAgent.push(['go_deliver'])
        }

} )
// client.onAgentsSensing( agentLoop )
// client.onYou( agentLoop )



/**
 * Intention revision loop
 */
class IntentionRevision {

    #intention_queue = new Array();
    get intention_queue () {
        return this.#intention_queue;
    }

    async loop ( ) {
        while ( true ) {
            // Consumes intention_queue if not empty
            if ( this.intention_queue.length > 0 ) {
                console.log( 'intentionRevision.loop', this.intention_queue.map(i=>i.predicate) );
            
                // Current intention
                const intention = this.intention_queue[0];
                
                // Is queued intention still valid? Do I still want to achieve it?
                // TODO this hard-coded implementation is an example
                let id = intention.predicate[2]
                let p = parcels.get(id)
                if ( p && p.carriedBy ) {
                    console.log( 'Skipping intention because no more valid', intention.predicate )
                    continue;
                }

                // Start achieving intention
                await intention.achieve()
                // Catch eventual error and continue
                .catch( error => {
                    // console.log( 'Failed intention', ...intention.predicate, 'with error:', ...error )
                } );

                // Remove from the queue
                this.intention_queue.shift();
            }
            // Postpone next iteration at setImmediate
            await new Promise( res => setImmediate( res ) );
        }
    }

    // async push ( predicate ) { }

    log ( ...args ) {
        console.log( ...args )
    }

}

class IntentionRevisionQueue extends IntentionRevision {

    async push ( predicate ) {
        
        // Check if already queued
        if ( this.intention_queue.find( (i) => i.predicate.join(' ') == predicate.join(' ') ) )
            return; // intention is already queued

        console.log( 'IntentionRevisionReplace.push', predicate );
        const intention = new Intention( this, predicate );
        this.intention_queue.push( intention );
    }

}

class IntentionRevisionReplace extends IntentionRevision {

    async push ( predicate ) {

        // Check if already queued
        const last = this.intention_queue.at( this.intention_queue.length - 1 );
        if ( last && last.predicate.join(' ') == predicate.join(' ') ) {
            return; // intention is already being achieved
        }
        
        console.log( 'IntentionRevisionReplace.push', predicate );
        const intention = new Intention( this, predicate );
        this.intention_queue.push( intention );
        
        // Force current intention stop 
        if ( last ) {
            last.stop();
        }
    }

}

class IntentionRevisionRevise extends IntentionRevision {

    async push ( predicate ) {
        console.log( 'Revising intention queue. Received', ...predicate );
        // TODO
        // - order intentions based on utility function (reward - cost) (for example, parcel score minus distance)
        // - eventually stop current one
        // - evaluate validity of intention
    }

}

/**
 * Start intention revision loop
 */

// const myAgent = new IntentionRevisionQueue();    // when I push an intention, it will be the last of the queue
const myAgent = new IntentionRevisionReplace();     // when I push an intention, it replace the old one
// const myAgent = new IntentionRevisionRevise();   
myAgent.loop();