import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "../../../../../../types/types";
import { isLeft } from "fp-ts/Either";
import { getGameRepo } from "../../../../../../server/repository/game";
import { SetWeatherStatusDecode } from "../../../../../../types/io-ts-def";
import { toApiResponse } from "../../../../../../server/turn";
import { MakeLeft, MakeRight } from "../../../../../../lib/io-ts-helpers";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } },
): Promise<NextResponse<ApiResponse | { error: string }>> {
    const id = params.id;

    const body = await request.json();

    if (!SetWeatherStatusDecode.is(body)) {
        return NextResponse.json(
            { error: "Incorrect request" },
            { status: 400 },
        );
    }

    const gameRepo = getGameRepo();

    if (isLeft(gameRepo)) {
        return NextResponse.json({ error: gameRepo.left }, { status: 500 });
    }

    const game = await gameRepo.right.get(id);

    if (isLeft(game)) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const newGame = await gameRepo.right.runControlAction(
        game.right,
        (game) => {
            const newGame = { ...game };

            // Find the defcon component
            const defconComponent = newGame.components.find(
                (val) => val.componentType == "Weather",
            );

            if (defconComponent?.componentType != "Weather") {
                return MakeLeft(`No weather component for game ${id}`);
            }

            defconComponent.weatherMessage = body.newWeatherMessage;

            if (!newGame.active) {
                const frozenComponent = newGame.frozenTurn.components.find(
                    (val) => val.componentType == "Weather",
                );

                if (frozenComponent?.componentType == "Weather") {
                    frozenComponent.weatherMessage = body.newWeatherMessage;
                }
            }

            return MakeRight(newGame);
        },
    );

    if (isLeft(newGame)) {
        return NextResponse.json({ error: newGame.left }, { status: 500 });
    }

    return NextResponse.json(toApiResponse(newGame.right));
}
