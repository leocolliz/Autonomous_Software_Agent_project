import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";

import {default as config} from '../config.js';
// import { GoPickUp, BlindMove } from './plan.js';
import { Intention } from "./intention.js";
import { path } from "./plan.js";

import UndirectedGraph from 'graphology';
import dijkstra from 'graphology-shortest-path';

export const client = new DeliverooApi(
    config.host,
    config.token
)

export function distance( {x:x1, y:y1}, {x:x2, y:y2}) {
    
    let path = dijkstra.bidirectional(mapGraph, Math.floor(x1) + "-" + Math.floor(y1), Math.floor(x2) + "-" + Math.floor(y2))
    
    if(!path){
        if(mapGraph.hasNode(Math.floor(x1) + "-" + Math.floor(y1)) && mapGraph.hasNode(Math.floor(x2) + "-" + Math.floor(y2))){
            console.log("POSIZIONI SBAGLIATE:", Math.floor(x1) + "-" + Math.floor(y1), Math.floor(x2) + "-" + Math.floor(y2));
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
    if(me.x % 1 == 0 && me.y % 1 == 0){
        for(let spot of deliverySpots){
            if(me.x == spot[0] && me.y == spot[1] && carrying){
                console.log("DELIVERYING AT: ", spot[0], spot[1], "(ON IT)");
                client.putdown();
                carrying = false;
            }
        }
        for(let parcel of storedParcels){
            if(me.x == parcel[1].x && me.y == parcel[1].y && parcel[1].carriedBy != me.id){
                client.pickup();
            }
        }
    }
} )
export const storedParcels = new Map();
let newParcels = true;
client.onParcelsSensing( async ( perceived_parcels ) => {
    for (const p of perceived_parcels) {
        if(!p.carriedBy){
            storedParcels.set( p.id, p)
        }
        if(!storedParcels.has(p.id)){
            newParcels = true;
        }else{
            newParcels = false;
        }
    }
} )
client.onConfig( (param) => {
    // console.log(param);
} )
    
let mapWidth;
let mapHeight;
let center = { x:Number.MAX_VALUE, y:Number.MAX_VALUE};
export let deliverySpots = [];
export let parcelSpawners = [];
export const mapGraph = new UndirectedGraph();

client.onMap( ( width, height, data ) => {
    mapWidth = width;
    mapHeight = height;
    let nodeId = new String;
    for(let tile of data){
        nodeId = tile.x + "-" + tile.y;
        mapGraph.addNode(nodeId, { x:tile.x, y:tile.y, delivery:tile.delivery, parcelSpawner:tile.parcelSpawner});
        if(tile.x < mapWidth/2){
            if(Math.abs(center.x - Math.floor(mapWidth/2)) > Math.abs(tile.x - Math.floor(mapWidth/2)) && Math.abs(center.y - Math.floor(mapHeight/2)) > Math.abs(tile.y - Math.floor(mapHeight/2))){
                center.x = Math.floor(tile.x);
                center.y = Math.floor(tile.y);
            }
        }
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
    for(const spot of buffer){
        deliverySpots.push(spot.split("-"));
    }

    // Parcel Spawners
    buffer = mapGraph.filterNodes((node, attributes) => {
        return attributes.parcelSpawner;
    })

    for(const spot of buffer){
        parcelSpawners.push(spot.split("-"));
    }

    console.log(center);
})

/**
 * Options generation and filtering function
 */
let carrying = false;
client.onParcelsSensing( parcels => {

    // TODO revisit beliefset revision so to trigger option generation only in the case a new parcel is observed
    // if((newParcels || myAgent.intention_queue.length == 0) || storedParcels.length == 0){
    
    /**
     * Options generation
     */
    const options = [];
    for (const parcel of parcels.values()){
        if ( ! parcel.carriedBy ){
            options.push( [ 'go_pick_up', Math.round(parcel.x), Math.round(parcel.y), parcel.id ] );
            for(const tile of path){
                if(tile.x == parcel.x && tile.y == parcel.y){
                    myAgent.push( [ 'go_pick_up', tile.x, tile.y, parcel.id ] );
                }
            }
        }
        else if( parcel.carriedBy == me.id ){
            carrying = true;
        }
        // myAgent.push( [ 'go_pick_up', parcel.x, parcel.y, parcel.id ] )
        // else if ( parcel.carriedBy == me.id){
        //     score += parcel.reward;
        // }
    }
    /**
     * Options filtering
     */
    let best_option;
    let nearestParcel = Number.MAX_VALUE;
    for (const option of options) {
        if ( option[0] == 'go_pick_up' ) {
            let [go_pick_up,x,y,id] = option;
            let current_d = distance( {x, y}, me )
            if ( current_d < nearestParcel ) {
                best_option = option
                nearestParcel = current_d
            }
        }
    }


    let nearestDeliver = Number.MAX_VALUE;
    let best_spot = [];
    for (const deliverySpot of deliverySpots) {
        let current_d = distance( {x:parseInt(deliverySpot[0]), y:parseInt(deliverySpot[1])}, me )
        if ( current_d < nearestDeliver ) {
            best_spot = deliverySpot;
            nearestDeliver = current_d
        }
    }

    if(best_option && carrying > 0){
        if(distance({x:best_spot[0],y:best_spot[1]}, me) < 5){
            best_option = ['go_deliver'];
        }
    }
    
    /**
     * Best option is selected
     */

    if ( best_option ){
        myAgent.push( best_option );
        // myAgent.push( [ 'go_deliver' ]);
    }
    // }

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
            // console.log("INTENTION QUEUE LENGTH: ", this.intention_queue.length);

            // Consumes intention_queue if not empty
            if ( this.intention_queue.length > 0 ) {
                // console.log( 'intentionRevision.loop', this.intention_queue.map(i=>i.predicate) );
            
                // Current intention
                const intention = this.intention_queue[0];
                
                // Is queued intention still valid? Do I still want to achieve it?
                // TODO this hard-coded implementation is an example
                let id = intention.predicate[2]
                let p = storedParcels.get(id)
                if ( p && p.carriedBy != me.id) {
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
            else if (this.intention_queue.length == 0) {
                let furthest = 0;
                let best_spot = [];
                
                if(parcelSpawners.length > 0){
                    for (const parcelSpawner of parcelSpawners) {
                        let current_d = distance( {x:parseInt(parcelSpawner[0]), y:parseInt(parcelSpawner[1])}, me )
                        if ( current_d > furthest ) {
                            best_spot = parcelSpawner;
                            furthest = current_d
                        }
                    }
                } else {
                    for (const deliverySpot of deliverySpots) {
                        let current_d = distance( {x:parseInt(deliverySpot[0]), y:parseInt(deliverySpot[1])}, me )
                        if ( current_d > furthest ) {
                            best_spot = deliverySpot;
                            furthest = current_d
                        }
                    }
                }

                console.log('BEST SPOT: ', best_spot);
                const intention = new Intention(this.myAgent, ['go_to', best_spot[0], best_spot[1]]);
                myAgent.push(intention.predicate);
            }
            
            await new Promise( res => setImmediate( res ) );
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
        
        const intention = new Intention( this, predicate );
        // this.intention_queue.push( intention );
        if(this.intention_queue[0]){
            this.intention_queue[1] = intention;
        }else{
            this.intention_queue[0] = intention;
        }
    }

}

class IntentionRevisionReplace extends IntentionRevision {

    async push ( predicate ) {
        // Check if already queued
        const last = this.intention_queue.at( this.intention_queue.length - 1 );
        if ( last && last.predicate.join(' ') == predicate.join(' ') && last.predicate[0] != 'go_deliver' ) {
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

const myAgent = new IntentionRevisionQueue();    // when I push an intention, it will be the last of the queue
// const myAgent = new IntentionRevisionReplace();     // when I push an intention, it replace the old one
// const myAgent = new IntentionRevisionRevise();   
myAgent.loop();