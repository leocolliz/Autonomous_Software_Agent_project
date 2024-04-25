export class Intention extends Promise {

    #current_plan;
    stop () {
        console.log( 'stop intention and current plan');
        this.#current_plan.stop();
    }

    #desire;
    #args;

    #resolve;
    #reject;

    constructor ( desire, ...args ) {
        var resolve, reject;
        super( async (res, rej) => {
            resolve = res; reject = rej;
        } )
        this.#resolve = resolve
        this.#reject = reject
        this.#desire = desire;
        this.#args = args;
    }

    #started = false;
    async achieve () {
        this.#started = true;


        let best_plan;
        let best_plan_score = Number.MIN_VALUE;
        for( const plan of plans ){
            if ( plan.isApplicableTo( this.#desire ) ) {
                this.#current_plan = plan;
                console.log('achieving desire', this.#desire, ...this.#args, 'with plan', this.#current_plan);
               
                try {
                    const plan_res = this.#current_plan.execute( ...args );
                    console.log('plan', plan, 'succesfully achieved intention', this.#desire, ...this.#args);
                } catch (error) {
                    console.log('plan', plan, 'failed to achieve intention', this.#desire, ...this.#args);
                }
            }
        }
    }

}