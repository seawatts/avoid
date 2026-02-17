import { init } from "@paralleldrive/cuid2";
import { nanoid } from "nanoid";

export function createId(props?: {
  prefix?: string;
  prefixSeparator?: string;
  length?: number;
  useNanoid?: boolean;
}) {
  let id: string;

  if (props?.useNanoid) {
    id = nanoid(props?.length);
  } else {
    const createIdFromInit = init({
      length: props?.length,
    });
    id = createIdFromInit();
  }

  if (props?.prefix) {
    const prefixSeparator = props.prefixSeparator ?? "_";
    id = `${props.prefix}${prefixSeparator}${id}`;
  }

  return id;
}

export { nanoid };
