/**
 * author thebadlorax
 * created on 01-04-2026-12h-50m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

import { GameWizard, Module, GamePlayer, GameTrigger} from "../game";

export class InventoryModule extends Module {
    public override trigger_functions: any = {
        "test2": (t: GameTrigger, p: GamePlayer) => { console.log("test2"); }
    };
    
    constructor(g: GameWizard) { super(g); }

    override init() {
        //this.game.onPlayerRegistration.push(this.onPlayerRegistration);
        //this.game.onPlayerUpdate.push(this.onPlayerUpdate);
        //this.game.middlemanSaveData.push(this.middlemanSaveData);
        //this.game.middlemanInstancePropogation.push(this.middlemanInstancePropogation);
        //this.game.middlemanStateSending.push(this.middlemanStateSending);
        this.game.TRIGGER_FUNCTIONS = {...this.game.TRIGGER_FUNCTIONS, ...this.trigger_functions};
    }
}