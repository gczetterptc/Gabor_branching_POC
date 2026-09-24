public class ADASController {

    private static final double EMERGENCY_BRAKE_DISTANCE = 10.0; // meters

    /**
     * Simple ADAS decision function.
     *
     * @param objectDistance Distance to detected object in meters
     * @param vehicleSpeed   Current speed in km/h
     * @return ADAS action
     */
    public static String evaluateSituation(double objectDistance, double vehicleSpeed) {

        if (objectDistance < EMERGENCY_BRAKE_DISTANCE) {
            return "EMERGENCY_BRAKE";
        }

        if (objectDistance < 30 && vehicleSpeed > 80) {
            return "FORWARD_COLLISION_WARNING";
        }

        return "NO_ACTION";
    }

    public static void main(String[] args) {

        double distance = 8.5;
        double speed = 90;

        String action = evaluateSituation(distance, speed);

        System.out.println("Distance: " + distance + " m");
        System.out.println("Speed: " + speed + " km/h");
        System.out.println("ADAS Action: " + action);
    }
}NEW Function