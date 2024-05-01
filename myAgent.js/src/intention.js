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


        //Plan selection
        let best_plan;
        let best_plan_score = Number.MIN_VALUE;
        for(const plan of plans){
            if(plan.isApplicableTo(this.#desire)){
                this.#current_plan = plan;
                console.log('achieving desire', this.#desire, this.args,
                            'with plan', plan);
                try{
                    const plan_res = await plan.execute(...this.#args);
                    console.log('plan', plan, 
                                'succesfully achieved intention', this.#desire, ...this.#args);
                }catch (error){
                    console.log('plan', plan, 
                                'failed to achieved intention', this.#desire, ...this.#args);
                    this.#reject( e );
                }
                
                // const score = plan.score(this.#desire, ...this.#args);
                // if(score > best_plan_score){
                //     best_plan = plan;
                //     best_plan_score = score; 
                // }
            }
        }
    }

}