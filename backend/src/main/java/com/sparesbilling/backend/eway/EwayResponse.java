package com.sparesbilling.backend.eway;

import java.time.LocalDate;

public record EwayResponse(
        Long invoiceId, String toPincode, String toPlace, Integer distanceKm, short transMode,
        String vehicleNo, String transporterName, String transporterId, String transDocNo,
        LocalDate transDocDate, String ewayBillNo, LocalDate ewayBillDate
) {
    public static EwayResponse from(EwayDetails d) {
        return new EwayResponse(d.getInvoiceId(), d.getToPincode(), d.getToPlace(), d.getDistanceKm(),
                d.getTransMode(), d.getVehicleNo(), d.getTransporterName(), d.getTransporterId(),
                d.getTransDocNo(), d.getTransDocDate(), d.getEwayBillNo(), d.getEwayBillDate());
    }

    public static EwayResponse empty(Long invoiceId) {
        return new EwayResponse(invoiceId, null, null, null, (short) 1, null, null, null, null, null, null, null);
    }
}