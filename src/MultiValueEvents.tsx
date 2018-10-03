import { initializeIcons } from "office-ui-fabric-react/lib/Icons";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { getClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItemFormService } from "TFS/WorkItemTracking/Services";
import { getSuggestedValues } from "./getSuggestedValues";
import { MultiValueControl } from "./MultiValueControl";

initializeIcons();
export class MultiValueEvents {
    public readonly fieldName = VSS.getConfiguration().witInputs.FieldName;
    private readonly _container = document.getElementById("container") as HTMLElement;
    private _onRefreshed: () => void;
    /** Counter to avoid consuming own changed field events. */
    private _fired: number = 0;

    public async refresh(selected?: string[]): Promise<void> {
        let error = "";
        if (!selected) {
            if (this._fired) {
                this._fired--;
                if (this._fired !== 0) {
                    return;
                }
                error = await this._checkFieldType();
                if (!error) {
                    return;
                }
            }
            selected = await this._getSelected();
        }

        ReactDOM.render(<MultiValueControl
            selected={selected}
            options={await getSuggestedValues()}
            onSelectionChanged={this._setSelected}
            width={this._container.scrollWidth}
            placeholder={selected.length ? "Click to Add" : "No selection made"}
            onResize={this._resize}
            error={error}
        />, this._container, () => {
            this._resize();
            if (this._onRefreshed) {
                this._onRefreshed();
            }
        });
    }
    private _resize = () => {
        VSS.resize(this._container.scrollWidth, this._container.scrollHeight);
    }
    private async _getSelected(): Promise<string[]> {
        const formService = await WorkItemFormService.getService();
        const value = await formService.getFieldValue(this.fieldName);
        if (typeof value !== "string") {
            return [];
        }
        return value.split(";").filter((v) => !!v);
    }
    private _setSelected = async (values: string[]): Promise<void> => {
        this.refresh(values);
        this._fired++;
        const formService = await WorkItemFormService.getService();

        await formService.setFieldValue(this.fieldName, values.join(";"));

        return new Promise<void>((resolve) => {
            this._onRefreshed = resolve;
        });
    }
    private async _checkFieldType(): Promise<string> {
        const formService = await WorkItemFormService.getService();
        const inv = await formService.getInvalidFields();
        if (inv.length > 0 && inv.some((f) => f.referenceName === this.fieldName)) {
            const field = await getClient().getField(this.fieldName);
            if (field.isPicklist && VSS.getConfiguration().witInputs.Values) {
                return `Set the field ${this.fieldName} to use suggested values rather than allowed values`;
            }
        }
        return "";
    }
}
